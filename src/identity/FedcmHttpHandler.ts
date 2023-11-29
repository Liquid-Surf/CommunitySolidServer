import { getLoggerFor } from '../logging/LogUtil';
import type { HttpHandlerInput } from '../server/HttpHandler';
import { HttpHandler } from '../server/HttpHandler';

/**
 * HTTP handler that redirects all requests to the FedCM library.
 */
export class FedcmHttpHandler extends HttpHandler {
  protected readonly logger = getLoggerFor(this);

  private readonly baseUrl: string;

  public constructor(baseUrl: string) {
    super();
    this.baseUrl = baseUrl;
  }

  public async handle({ request, response }: HttpHandlerInput): Promise<void> {
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
    response.writeHead(500, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({'error': { 'message': 'Fail in FedcmHttpHandler to handle the request url.'}}));
  }

  
  private async handleWebIdentity({request, response }: HttpHandlerInput): Promise<void> {
    const providers = [ `${this.baseUrl}/.well-known/fedcm/fedcm.js`]
    response.writeHead(200, { 'Content-Type': 'application/json'})
    response.end(JSON.stringify({'provider_urls': providers}))
  }
  private async handleFedcmJSON({request, response }: HttpHandlerInput): Promise<void> {
    const config = {
      "accounts_endpoint": "/.well-known/fedcm/accounts_endpoint",
      "client_metadata_endpoint": "/.well-known/fedcm/client_metadata_endpoint",
      "id_assertion_endpoint": "/.well-known/fedcm/token_endpoint",
      "revocation_endpoint": "/.well-known/fedcm/revocation_endpoint",
      "login_url": "/.account/login/password/",
      "branding": {
        "background_color": "rgb(055, 055, 204)",
        "color": "0xffffff",
        "icons": [
          {
            "url": `${this.baseUrl}/.well-known/css/images/solid.svg`,
            "size": 32
          }
        ]
      }
    }
    
    response.writeHead(200, { 'Content-Type': 'application/json'})
    response.end(JSON.stringify(config))
  }
  private async handleAccountsEnpoint({request, response }: HttpHandlerInput): Promise<void> {
    // sessionId = parse(request.cookie)
    // user = fetchUser(sessionId)
    // user_accounts = list_accounts(user)
    const accounts = {
      'accounts': []
    }
    response.writeHead(200, { 'Content-Type': 'application/json'})
    response.end(JSON.stringify(accounts))
  }
  private async handleClientMetadataEndpoint({ response }: HttpHandlerInput): Promise<void> {
    const metadata = {
      privacy_policy_url: '...',
      terms_of_service_url: '...'
    };
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(metadata));
  }

}


