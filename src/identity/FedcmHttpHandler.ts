import { getLoggerFor } from '../logging/LogUtil';
import type { HttpHandlerInput } from '../server/HttpHandler';
import { HttpHandler } from '../server/HttpHandler';

/**
 * HTTP handler that redirects all requests to the OIDC library.
 */
export class FedcmHttpHandler extends HttpHandler {
  protected readonly logger = getLoggerFor(this);

  public async handle({ request, response }: HttpHandlerInput): Promise<void> {
    const currentDate = JSON.stringify({ date: new Date().toISOString() });
    switch (request.url) {
      case '/.well-known/web-identity':
        await this.handleWebIdentity({request, response })
        break;
      case '/.well-known/fedcm/fedcm.json':
        await this.handleFedcmJSON({request, response })
        break;
      case '/.well-known/fedcm/accounts_endpoint':
        await this.handleAccountsEnpoint({request, response })
        break;
      case '/.well-known/fedcm/client_metadata_endpoint':
        await this.handleClientMetadataEndpoint({request, response })
        break;

      default:
        break;
    }
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(currentDate);
  }

  
  async handleWebIdentity({request, response }: HttpHandlerInput): Promise<void> {
    response.writeHead(200, { 'Content-Type': 'application/json'})
    response.end(JSON.stringify({'resp': request.url}))
  }
  async handleFedcmJSON({request, response }: HttpHandlerInput): Promise<void> {
    response.writeHead(200, { 'Content-Type': 'application/json'})
    response.end(JSON.stringify({'resp': request.url}))
  }
  async handleAccountsEnpoint({request, response }: HttpHandlerInput): Promise<void> {
    response.writeHead(200, { 'Content-Type': 'application/json'})
    response.end(JSON.stringify({'resp': request.url}))
  }
  async handleClientMetadataEndpoint({request, response }: HttpHandlerInput): Promise<void> {
    response.writeHead(200, { 'Content-Type': 'application/json'})
    response.end(JSON.stringify({'resp': request.url}))
  }

}


