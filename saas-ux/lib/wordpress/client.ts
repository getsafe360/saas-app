// lib/wordpress/client.ts
// WordPress REST API client with error handling and retries

/**
 * WordPress API error codes
 */
export enum WordPressErrorCode {
  TIMEOUT = 'TIMEOUT',
  ENDPOINT_NOT_FOUND = 'ENDPOINT_NOT_FOUND',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  PLUGIN_NOT_INSTALLED = 'PLUGIN_NOT_INSTALLED',
}

/**
 * User-friendly error messages for non-technical users
 */
export const USER_FRIENDLY_ERRORS: Record<WordPressErrorCode, {
  title: string;
  message: string;
  action: string;
}> = {
  [WordPressErrorCode.TIMEOUT]: {
    title: 'Connection Timeout',
    message: 'Your WordPress site took too long to respond.',
    action: 'Check if your site is online and try again.',
  },
  [WordPressErrorCode.ENDPOINT_NOT_FOUND]: {
    title: 'Plugin Not Found',
    message: 'The GetSafe 360 plugin endpoint was not found on your WordPress site.',
    action: 'Make sure the plugin is installed and activated.',
  },
  [WordPressErrorCode.AUTHENTICATION_FAILED]: {
    title: 'Authentication Failed',
    message: 'Could not verify your site credentials.',
    action: 'Try disconnecting and reconnecting your site.',
  },
  [WordPressErrorCode.CONNECTION_FAILED]: {
    title: 'Connection Failed',
    message: 'Could not reach your WordPress site.',
    action: 'Check your site URL and make sure it\'s accessible.',
  },
  [WordPressErrorCode.INVALID_RESPONSE]: {
    title: 'Invalid Response',
    message: 'Your WordPress site returned an unexpected response.',
    action: 'Check if the GetSafe 360 plugin is up to date.',
  },
  [WordPressErrorCode.PLUGIN_NOT_INSTALLED]: {
    title: 'Plugin Not Installed',
    message: 'The GetSafe 360 Connector plugin is not installed.',
    action: 'Download and install the plugin from your site dashboard.',
  },
};

export class WordPressAPIError extends Error {
  constructor(
    public code: WordPressErrorCode,
    public userMessage: string,
    public details?: string
  ) {
    super(userMessage);
    this.name = 'WordPressAPIError';
  }

  toJSON() {
    const friendlyError = USER_FRIENDLY_ERRORS[this.code];
    return {
      code: this.code,
      message: this.userMessage,
      details: this.details,
      title: friendlyError.title,
      action: friendlyError.action,
    };
  }
}

/**
 * WordPress API client configuration
 */
export interface WordPressClientConfig {
  siteUrl: string;
  tokenHash?: string;
  timeout?: number;
  retries?: number;
}

/**
 * WordPress API response types
 */
export interface WordPressStatusResponse {
  connected: boolean;
  version: string;
  pluginVersion: string;
  timestamp: string;
}

/**
 * WordPress REST API Client
 *
 * Handles communication with WordPress sites via the GetSafe 360 plugin endpoints
 */
export class WordPressClient {
  private siteUrl: string;
  private tokenHash?: string;
  private timeout: number;
  private retries: number;

  constructor(config: WordPressClientConfig) {
    this.siteUrl = config.siteUrl.replace(/\/$/, ''); // Remove trailing slash
    this.tokenHash = config.tokenHash;
    this.timeout = config.timeout || 10000; // 10 seconds default
    this.retries = config.retries || 0;
  }

  /**
   * Build WordPress REST API endpoint URL
   */
  private getEndpointUrl(path: string): string {
    return `${this.siteUrl}/wp-json/getsafe360/v1/${path}`;
  }

  /**
   * Make authenticated request to WordPress API
   */
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = this.getEndpointUrl(path);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      if (this.tokenHash) {
        headers['X-API-Key'] = this.tokenHash;
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle HTTP errors
      if (!response.ok) {
        if (response.status === 404) {
          throw new WordPressAPIError(
            WordPressErrorCode.ENDPOINT_NOT_FOUND,
            'WordPress API endpoint not found',
            `GET ${url} returned 404`
          );
        }

        if (response.status === 401 || response.status === 403) {
          throw new WordPressAPIError(
            WordPressErrorCode.AUTHENTICATION_FAILED,
            'WordPress API authentication failed',
            `GET ${url} returned ${response.status}`
          );
        }

        throw new WordPressAPIError(
          WordPressErrorCode.CONNECTION_FAILED,
          'WordPress API request failed',
          `GET ${url} returned ${response.status}: ${response.statusText}`
        );
      }

      // Parse JSON response
      const data = await response.json();
      return data as T;

    } catch (error: any) {
      clearTimeout(timeoutId);

      // Handle timeout
      if (error.name === 'AbortError') {
        throw new WordPressAPIError(
          WordPressErrorCode.TIMEOUT,
          'WordPress site connection timeout',
          `Request to ${url} timed out after ${this.timeout}ms`
        );
      }

      // Re-throw WordPressAPIError
      if (error instanceof WordPressAPIError) {
        throw error;
      }

      // Handle other errors
      throw new WordPressAPIError(
        WordPressErrorCode.CONNECTION_FAILED,
        'Could not connect to WordPress site',
        error.message
      );
    }
  }

  /**
   * Ping WordPress site to check if plugin is installed and reachable
   *
   * @returns True if ping successful
   */
  async ping(): Promise<boolean> {
    try {
      const response = await this.request<{ pong: boolean }>('ping');
      return response.pong === true;
    } catch (error) {
      if (error instanceof WordPressAPIError &&
          error.code === WordPressErrorCode.ENDPOINT_NOT_FOUND) {
        throw new WordPressAPIError(
          WordPressErrorCode.PLUGIN_NOT_INSTALLED,
          'GetSafe 360 plugin is not installed or activated',
          'Ping endpoint not found'
        );
      }
      throw error;
    }
  }

  /**
   * Get WordPress site status and version information
   *
   * @returns WordPress status response
   */
  async getStatus(): Promise<WordPressStatusResponse> {
    return this.request<WordPressStatusResponse>('status');
  }

  /**
   * Test connection to WordPress site
   *
   * Returns detailed diagnostics for troubleshooting
   *
   * @returns Test result with diagnostics
   */
  async testConnection(): Promise<{
    success: boolean;
    reachable: boolean;
    pluginInstalled: boolean;
    authenticated: boolean;
    wpVersion?: string;
    pluginVersion?: string;
    error?: WordPressAPIError;
  }> {
    const result = {
      success: false,
      reachable: false,
      pluginInstalled: false,
      authenticated: false,
    };

    try {
      // Test 1: Check if site is reachable
      const pingResult = await this.ping();
      result.reachable = pingResult;
      result.pluginInstalled = pingResult;

      // Test 2: Get status (requires authentication)
      const status = await this.getStatus();
      result.authenticated = true;
      result.success = true;

      return {
        ...result,
        wpVersion: status.version,
        pluginVersion: status.pluginVersion,
      };

    } catch (error) {
      if (error instanceof WordPressAPIError) {
        return {
          ...result,
          error,
        };
      }

      return {
        ...result,
        error: new WordPressAPIError(
          WordPressErrorCode.CONNECTION_FAILED,
          'Connection test failed',
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
  }
}

/**
 * Create a WordPress client instance
 *
 * @param config - Client configuration
 * @returns WordPressClient instance
 */
export function createWordPressClient(
  config: WordPressClientConfig
): WordPressClient {
  return new WordPressClient(config);
}
