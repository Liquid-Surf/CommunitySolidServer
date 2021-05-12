import type { Representation } from '../../../../src/ldp/representation/Representation';
import { RepresentationMetadata } from '../../../../src/ldp/representation/RepresentationMetadata';
import type {
  RepresentationPreferences,
  ValuePreferences,
} from '../../../../src/ldp/representation/RepresentationPreferences';
import { ChainedConverter } from '../../../../src/storage/conversion/ChainedConverter';
import { matchesMediaType } from '../../../../src/storage/conversion/ConversionUtil';
import type { RepresentationConverterArgs } from '../../../../src/storage/conversion/RepresentationConverter';
import { TypedRepresentationConverter } from '../../../../src/storage/conversion/TypedRepresentationConverter';
import { CONTENT_TYPE } from '../../../../src/util/Vocabularies';

class DummyConverter extends TypedRepresentationConverter {
  private readonly inTypes: ValuePreferences;
  private readonly outTypes: ValuePreferences;

  public constructor(inTypes: ValuePreferences, outTypes: ValuePreferences) {
    super();
    this.inTypes = inTypes;
    this.outTypes = outTypes;
  }

  public async getInputTypes(): Promise<ValuePreferences> {
    return this.inTypes;
  }

  public async getOutputTypes(): Promise<ValuePreferences> {
    return this.outTypes;
  }

  public async handle(input: RepresentationConverterArgs): Promise<Representation> {
    // Make sure the input type is supported
    const inType = input.representation.metadata.contentType!;
    if (!Object.entries(this.inTypes).some(([ range, weight ]): boolean =>
      weight > 0 && matchesMediaType(range, inType))) {
      throw new Error(`Unsupported input: ${inType}`);
    }

    // Make sure we're sending preferences that are actually supported
    const outType = Object.keys(input.preferences.type!)[0];
    if (!Object.entries(this.outTypes).some(([ range, weight ]): boolean =>
      weight > 0 && matchesMediaType(range, outType))) {
      throw new Error(`Unsupported output: ${outType}`);
    }
    const metadata = new RepresentationMetadata(input.representation.metadata,
      { [CONTENT_TYPE]: outType });
    return { ...input.representation, metadata };
  }
}

describe('A ChainedConverter', (): void => {
  let representation: Representation;
  let preferences: RepresentationPreferences;
  let args: RepresentationConverterArgs;

  beforeEach(async(): Promise<void> => {
    const metadata = new RepresentationMetadata('a/a');
    representation = { metadata } as Representation;
    preferences = { type: { 'x/x': 1, 'x/*': 0.8 }};
    args = { representation, preferences, identifier: { path: 'path' }};
  });

  it('needs at least 1 converter.', async(): Promise<void> => {
    expect((): any => new ChainedConverter([])).toThrow('At least 1 converter is required.');
    expect(new ChainedConverter([ new DummyConverter({ }, { }) ])).toBeInstanceOf(ChainedConverter);
  });

  it('errors if there are no content-type or preferences.', async(): Promise<void> => {
    args.representation.metadata.contentType = undefined;
    const converters = [ new DummyConverter({ 'a/a': 1 }, { 'x/x': 1 }) ];
    const converter = new ChainedConverter(converters);
    await expect(converter.canHandle(args)).rejects.toThrow('Missing Content-Type header.');
  });

  it('errors if no path can be found.', async(): Promise<void> => {
    const converters = [ new DummyConverter({ 'a/a': 1 }, { 'x/x': 1 }) ];
    const converter = new ChainedConverter(converters);

    args.representation.metadata.contentType = 'b/b';
    await expect(converter.canHandle(args)).rejects
      .toThrow('No conversion path could be made from b/b to x/x,x/*,internal/*.');
  });

  it('can handle situations where no conversion is required.', async(): Promise<void> => {
    const converters = [ new DummyConverter({ 'a/a': 1 }, { 'x/x': 1 }) ];
    args.representation.metadata.contentType = 'b/b';
    args.preferences.type = { 'b/*': 0.5 };
    const converter = new ChainedConverter(converters);

    const result = await converter.handle(args);
    expect(result.metadata.contentType).toBe('b/b');
  });

  it('interprets no preferences as */*.', async(): Promise<void> => {
    const converters = [ new DummyConverter({ 'a/a': 1 }, { 'x/x': 1 }) ];
    const converter = new ChainedConverter(converters);
    args.representation.metadata.contentType = 'b/b';
    args.preferences.type = undefined;

    let result = await converter.handle(args);
    expect(result.metadata.contentType).toBe('b/b');

    args.preferences.type = { };
    result = await converter.handle(args);
    expect(result.metadata.contentType).toBe('b/b');
  });

  it('can find paths of length 1.', async(): Promise<void> => {
    const converters = [ new DummyConverter({ 'a/a': 1 }, { 'x/x': 1 }) ];
    const converter = new ChainedConverter(converters);

    const result = await converter.handle(args);
    expect(result.metadata.contentType).toBe('x/x');
  });

  it('can find longer paths.', async(): Promise<void> => {
    // Path: a/a -> b/b -> c/c -> x/x
    const converters = [
      new DummyConverter({ 'b/b': 0.8, 'b/c': 1 }, { 'c/b': 0.9, 'c/c': 1 }),
      new DummyConverter({ 'a/a': 0.8, 'a/b': 1 }, { 'b/b': 0.9, 'b/a': 0.5 }),
      new DummyConverter({ 'd/d': 0.8, 'c/*': 1 }, { 'x/x': 0.9, 'x/a': 1 }),
    ];
    const converter = new ChainedConverter(converters);

    const result = await converter.handle(args);
    expect(result.metadata.contentType).toBe('x/x');
  });

  it('will use the best path among the shortest found.', async(): Promise<void> => {
    // Valid paths: 0 -> 1 -> 2, 3 -> 2, 4 -> 2, 5 -> 2, *6 -> 2*
    const converters = [
      new DummyConverter({ 'a/a': 1 }, { 'b/b': 1 }),
      new DummyConverter({ 'b/b': 1 }, { 'c/c': 1 }),
      new DummyConverter({ 'c/c': 1 }, { 'x/x': 1 }),
      new DummyConverter({ '*/*': 0.5 }, { 'c/c': 1 }),
      new DummyConverter({ 'a/a': 0.8 }, { 'c/c': 1 }),
      new DummyConverter({ 'a/*': 1 }, { 'c/c': 0.5 }),
      new DummyConverter({ 'a/a': 1 }, { 'c/c': 0.9 }),
    ];
    const converter = new ChainedConverter(converters);

    // Only the best converters should have been called (6 and 2)
    for (const dummyConverter of converters) {
      jest.spyOn(dummyConverter, 'handle');
    }
    const result = await converter.handle(args);
    expect(result.metadata.contentType).toBe('x/x');
    expect(converters[0].handle).toHaveBeenCalledTimes(0);
    expect(converters[1].handle).toHaveBeenCalledTimes(0);
    expect(converters[2].handle).toHaveBeenCalledTimes(1);
    expect(converters[3].handle).toHaveBeenCalledTimes(0);
    expect(converters[4].handle).toHaveBeenCalledTimes(0);
    expect(converters[5].handle).toHaveBeenCalledTimes(0);
    expect(converters[6].handle).toHaveBeenCalledTimes(1);
  });

  it('will use the intermediate content-types with the best weight.', async(): Promise<void> => {
    const converters = [
      new DummyConverter({ 'a/a': 1 }, { 'b/b': 0.8, 'c/c': 0.6 }),
      new DummyConverter({ 'b/b': 0.1, 'c/*': 0.9 }, { 'd/d': 1, 'e/e': 0.8 }),
      new DummyConverter({ 'd/*': 0.9, 'e/*': 0.1 }, { 'x/x': 1 }),
    ];
    const converter = new ChainedConverter(converters);

    jest.spyOn(converters[0], 'handle');
    jest.spyOn(converters[1], 'handle');
    const result = await converter.handle(args);
    expect(result.metadata.contentType).toBe('x/x');
    let { metadata } = await (converters[0].handle as jest.Mock).mock.results[0].value;
    expect(metadata.contentType).toBe('c/c');
    ({ metadata } = await (converters[1].handle as jest.Mock).mock.results[0].value);
    expect(metadata.contentType).toBe('d/d');
  });

  it('calls handle when calling handleSafe.', async(): Promise<void> => {
    const converters = [ new DummyConverter({ 'a/a': 1 }, { 'x/x': 1 }) ];
    const converter = new ChainedConverter(converters);
    jest.spyOn(converter, 'handle');

    await converter.handleSafe(args);
    expect(converter.handle).toHaveBeenCalledTimes(1);
    expect(converter.handle).toHaveBeenLastCalledWith(args);
  });

  it('caches paths for re-use.', async(): Promise<void> => {
    const converters = [
      new DummyConverter({ 'a/a': 0.8 }, { 'b/b': 0.9 }),
      new DummyConverter({ 'b/b': 0.8 }, { 'x/x': 1 }),
    ];
    const converter = new ChainedConverter(converters);
    let result = await converter.handle(args);
    expect(result.metadata.contentType).toBe('x/x');

    jest.spyOn(converters[0], 'getInputTypes');
    jest.spyOn(converters[0], 'getOutputTypes');
    result = await converter.handle(args);
    expect(result.metadata.contentType).toBe('x/x');
    expect(converters[0].getInputTypes).toHaveBeenCalledTimes(0);
    expect(converters[0].getOutputTypes).toHaveBeenCalledTimes(0);
  });

  it('removes unused paths from the cache.', async(): Promise<void> => {
    const converters = [
      new DummyConverter({ 'a/a': 0.8 }, { 'b/b': 0.9 }),
      new DummyConverter({ 'b/b': 0.8 }, { 'x/x': 1 }),
      new DummyConverter({ 'c/c': 0.8 }, { 'b/b': 0.9 }),
    ];
    // Cache size 1
    const converter = new ChainedConverter(converters, 1);
    let result = await converter.handle(args);
    expect(result.metadata.contentType).toBe('x/x');

    // Should remove previous path (which contains converter 0)
    args.representation.metadata.contentType = 'c/c';
    result = await converter.handle(args);
    expect(result.metadata.contentType).toBe('x/x');

    jest.spyOn(converters[0], 'getInputTypes');
    jest.spyOn(converters[0], 'getOutputTypes');
    args.representation.metadata.contentType = 'a/a';
    result = await converter.handle(args);
    expect(result.metadata.contentType).toBe('x/x');
    expect(converters[0].getInputTypes).not.toHaveBeenCalledTimes(0);
    expect(converters[0].getOutputTypes).not.toHaveBeenCalledTimes(0);
  });

  it('keeps the most recently used paths in the cache.', async(): Promise<void> => {
    const converters = [
      new DummyConverter({ 'a/a': 1 }, { 'd/d': 1 }),
      new DummyConverter({ 'b/b': 1 }, { 'd/d': 1 }),
      new DummyConverter({ 'c/c': 1 }, { 'd/d': 1 }),
      new DummyConverter({ 'd/d': 1 }, { 'x/x': 1 }),
    ];
    // Cache size 2
    const converter = new ChainedConverter(converters, 2);
    // Caches path 0
    await converter.handle(args);

    // Caches path 1
    args.representation.metadata.contentType = 'b/b';
    await converter.handle(args);

    // Reset path 0 in cache
    args.representation.metadata.contentType = 'a/a';
    await converter.handle(args);

    // Caches path 2 and removes 1
    args.representation.metadata.contentType = 'c/c';
    await converter.handle(args);

    jest.spyOn(converters[0], 'getInputTypes');
    jest.spyOn(converters[1], 'getInputTypes');
    jest.spyOn(converters[2], 'getInputTypes');

    // Path 0 and 2 should be cached now
    args.representation.metadata.contentType = 'a/a';
    await converter.handle(args);
    expect(converters[0].getInputTypes).toHaveBeenCalledTimes(0);
    args.representation.metadata.contentType = 'c/c';
    await converter.handle(args);
    expect(converters[2].getInputTypes).toHaveBeenCalledTimes(0);
    args.representation.metadata.contentType = 'b/b';
    await converter.handle(args);
    expect(converters[1].getInputTypes).not.toHaveBeenCalledTimes(0);
  });

  it('does not use cached paths that match content-type but not preferences.', async(): Promise<void> => {
    const converters = [
      new DummyConverter({ 'a/a': 1 }, { 'b/b': 1 }),
      new DummyConverter({ 'b/b': 1 }, { 'x/x': 1 }),
      new DummyConverter({ 'a/a': 1 }, { 'c/c': 1 }),
      new DummyConverter({ 'c/c': 1 }, { 'y/y': 1 }),
    ];
    const converter = new ChainedConverter(converters);

    // Cache a-b-x path
    await converter.handle(args);

    // Generate new a-c-y path
    args.preferences.type = { 'y/y': 1 };
    const result = await converter.handle(args);
    expect(result.metadata.contentType).toBe('y/y');
  });
});
