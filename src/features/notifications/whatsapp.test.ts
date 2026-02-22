import { describe, it, expect, vi } from 'vitest';
import { sendWhatsAppNotification } from './whatsapp';

// Mock console.log
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('sendWhatsAppNotification', () => {
  it('should log the correct message format', async () => {
    const mockData = {
      orderId: 'uuid-123',
      readableId: 1001,
      customerName: 'John Doe',
      phoneNumber: '1234567890',
      totalAmount: 500,
      balance: {
        current: -100, // Payable
        currency: 'PKR',
      },
      items: [
        { productName: 'Water Bottle', quantity: 2, price: 250 },
      ],
      bottleWallet: [
        { productName: 'Empty Bottle', balance: 5 },
      ],
    };

    await sendWhatsAppNotification(mockData);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[WhatsApp Mock] Sending to 1234567890'));

    // Check message content in the log
    const calls = consoleLogSpy.mock.calls;
    const messageLog = calls.find(call => call[0].includes('Order Delivered!'));

    expect(messageLog).toBeDefined();
    const message = messageLog![0];

    expect(message).toContain('Order #1001');
    expect(message).toContain('Hello John Doe');
    expect(message).toContain('Water Bottle: 2 x 250');
    expect(message).toContain('Total: 500 PKR');
    expect(message).toContain('Payable: 100 PKR'); // -100 means payable
    expect(message).toContain('Empty Bottle: 5 bottles');
  });

  it('should handle advance credit (positive balance)', async () => {
    const mockData = {
      orderId: 'uuid-124',
      readableId: 1002,
      customerName: 'Jane Doe',
      phoneNumber: '0987654321',
      totalAmount: 0,
      balance: {
        current: 200, // Advance
        currency: 'PKR',
      },
      items: [],
      bottleWallet: [],
    };

    await sendWhatsAppNotification(mockData);

    const calls = consoleLogSpy.mock.calls;
    // We look for the last call or search for Jane Doe
    const messageLog = calls.find(call => typeof call[0] === 'string' && call[0].includes('Jane Doe'));
    const message = messageLog![0];

    expect(message).toContain('Advance Credit: 200 PKR');
    expect(message).toContain('No bottles held');
  });
});
