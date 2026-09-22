/**
 * Africa's Talking SMS Provider Response Handling Tests
 * Tests for safe response parsing and error handling
 */

import { AfricasTalkingProvider } from '../src/services/sms/africas-talking.provider';

// Mock fetch to simulate various Africa's Talking responses
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('Africa\'s Talking SMS Provider - Response Handling', () => {
  let provider: AfricasTalkingProvider;

  beforeEach(() => {
    // Reset environment variables for testing
    process.env.AFRICAS_TALKING_USERNAME = 'testuser';
    process.env.AFRICAS_TALKING_API_KEY = 'testkey';
    provider = new AfricasTalkingProvider();
    mockFetch.mockClear();
  });

  afterEach(() => {
    delete process.env.AFRICAS_TALKING_USERNAME;
    delete process.env.AFRICAS_TALKING_API_KEY;
  });

  describe('Successful JSON response', () => {
    it('should handle valid JSON success response', async () => {
      const successResponse = {
        SMSMessageData: {
          Message: 'Sent to 1/1 Total Cost: KES 0.8000',
          Recipients: [{
            statusCode: 101,
            number: '+233241234567',
            status: 'Success',
            cost: 'KES 0.8000',
            messageId: 'ATXid_12345'
          }]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: {
          get: (name: string) => name === 'content-type' ? 'application/json' : null
        },
        text: async () => JSON.stringify(successResponse),
        json: async () => successResponse
      });

      await expect(provider.sendOtp('+233241234567', '123456')).resolves.not.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Verify API key header is included
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].headers.ApiKey).toBe('testkey');
    });

    it('should handle queued message status', async () => {
      const queuedResponse = {
        SMSMessageData: {
          Message: 'Sent to 1/1 Total Cost: KES 0.8000',
          Recipients: [{
            statusCode: 102,
            number: '+233241234567',
            status: 'Queued',
            cost: 'KES 0.8000',
            messageId: 'ATXid_12345'
          }]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: {
          get: (name: string) => name === 'content-type' ? 'application/json' : null
        },
        text: async () => JSON.stringify(queuedResponse),
        json: async () => queuedResponse
      });

      await expect(provider.sendOtp('+233241234567', '123456')).rejects.toThrow('SMS delivery failed');
      
      // Verify API key header is included
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].headers.ApiKey).toBe('testkey');
    });
  });

  describe('Non-2xx HTTP responses', () => {
    it('should handle 401 Unauthorized JSON error response', async () => {
      const errorResponse = {
        errorMessage: 'Invalid API key',
        code: '401'
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: {
          get: (name: string) => name === 'content-type' ? 'application/json' : null
        },
        text: async () => JSON.stringify(errorResponse),
        json: async () => errorResponse
      });

      await expect(provider.sendOtp('+233241234567', '123456')).rejects.toThrow("Africa's Talking API error: HTTP 401");
      
      // Verify API key header was sent (even if invalid)
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].headers.ApiKey).toBe('testkey');
    });

    it('should handle 400 Bad Request JSON error response', async () => {
      const errorResponse = {
        errorMessage: 'Invalid phone number format',
        code: '400'
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: {
          get: (name: string) => name === 'content-type' ? 'application/json' : null
        },
        text: async () => JSON.stringify(errorResponse),
        json: async () => errorResponse
      });

      await expect(provider.sendOtp('+233241234567', '123456')).rejects.toThrow("Africa's Talking API error: HTTP 400");
    });

    it('should handle non-JSON error response (plain text)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: {
          get: (name: string) => name === 'content-type' ? 'text/plain' : null
        },
        text: async () => 'Internal Server Error',
        json: async () => { throw new Error('Not JSON'); }
      });

      await expect(provider.sendOtp('+233241234567', '123456')).rejects.toThrow("Africa's Talking API error: HTTP 500");
    });

    it('should handle text/plain error response starting with "T"', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: {
          get: (name: string) => name === 'content-type' ? 'text/plain' : null
        },
        text: async () => 'Temporary service unavailable',
        json: async () => { throw new Error('Not JSON'); }
      });

      await expect(provider.sendOtp('+233241234567', '123456')).rejects.toThrow("Africa's Talking API error: HTTP 403");
    });
  });

  describe('Malformed/unexpected responses', () => {
    it('should handle JSON response with unexpected structure', async () => {
      const malformedResponse = {
        unexpectedField: 'value',
        wrongStructure: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => name === 'content-type' ? 'application/json' : null
        },
        text: async () => JSON.stringify(malformedResponse),
        json: async () => malformedResponse
      });

      await expect(provider.sendOtp('+233241234567', '123456')).rejects.toThrow('SMS delivery failed');
    });

    it('should handle non-JSON success response (should not happen but must not crash)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => name === 'content-type' ? 'text/plain' : null
        },
        text: async () => 'OK',
        json: async () => { throw new Error('Not JSON'); }
      });

      await expect(provider.sendOtp('+233241234567', '123456')).rejects.toThrow('Unexpected response format');
    });

    it('should handle invalid JSON in success response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => name === 'content-type' ? 'application/json' : null
        },
        text: async () => '{invalid json}',
        json: async () => { throw new SyntaxError('Unexpected token i'); }
      });

      await expect(provider.sendOtp('+233241234567', '123456')).rejects.toThrow('Invalid JSON response');
    });

    it('should handle response beginning with "T" without JSON parse error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: {
          get: (name: string) => name === 'content-type' ? 'text/plain' : null
        },
        text: async () => 'Temporary unavailable due to maintenance',
        json: async () => { throw new SyntaxError('Unexpected token T'); }
      });

      await expect(provider.sendOtp('+233241234567', '123456')).rejects.toThrow("Africa's Talking API error: HTTP 503");
    });
  });

  describe('Missing credentials', () => {
    it('should throw error when credentials are not configured', async () => {
      delete process.env.AFRICAS_TALKING_USERNAME;
      delete process.env.AFRICAS_TALKING_API_KEY;
      const providerNoCreds = new AfricasTalkingProvider();

      await expect(providerNoCreds.sendOtp('+233241234567', '123456')).rejects.toThrow('Africa\'s Talking credentials not configured');
    });
  });

  describe('Authentication mechanism', () => {
    it('should include ApiKey header in request', async () => {
      const successResponse = {
        SMSMessageData: {
          Message: 'Sent to 1/1 Total Cost: KES 0.8000',
          Recipients: [{
            statusCode: 101,
            number: '+233241234567',
            status: 'Success',
            cost: 'KES 0.8000',
            messageId: 'ATXid_12345'
          }]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: {
          get: (name: string) => name === 'content-type' ? 'application/json' : null
        },
        text: async () => JSON.stringify(successResponse),
        json: async () => successResponse
      });

      await provider.sendOtp('+233241234567', '123456');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.africastalking.com/version1/messaging',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'ApiKey': 'testkey',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          })
        })
      );
    });

    it('should include username in request body', async () => {
      const successResponse = {
        SMSMessageData: {
          Message: 'Sent to 1/1 Total Cost: KES 0.8000',
          Recipients: [{
            statusCode: 101,
            number: '+233241234567',
            status: 'Success',
            cost: 'KES 0.8000',
            messageId: 'ATXid_12345'
          }]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: {
          get: (name: string) => name === 'content-type' ? 'application/json' : null
        },
        text: async () => JSON.stringify(successResponse),
        json: async () => successResponse
      });

      await provider.sendOtp('+233241234567', '123456');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchCall = mockFetch.mock.calls[0];
      const body = fetchCall[1].body;
      
      // Convert URLSearchParams to string for checking
      const bodyString = body instanceof URLSearchParams ? body.toString() : body;
      
      expect(bodyString).toContain('username=testuser');
      expect(bodyString).toContain('to=%2B233241234567');
      expect(bodyString).toContain('from=CRAVE');
    });
  });
});
