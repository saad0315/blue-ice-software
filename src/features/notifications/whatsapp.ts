import { db } from "@/lib/db";

// ------------------------------------------------------------
// INTERFACES
// ------------------------------------------------------------

export interface OrderNotificationData {
  orderId: string;
  readableId: number;
  customerName: string;
  phoneNumber: string;
  totalAmount: number;
  items: {
    productName: string;
    quantity: number;
    price: number;
  }[];
  balance: {
    current: number; // Current outstanding (including this order)
    currency: string;
  };
  bottleWallet: {
    productName: string;
    balance: number;
  }[];
}

// ------------------------------------------------------------
// MAIN FUNCTION
// ------------------------------------------------------------

export async function sendWhatsAppNotification(data: OrderNotificationData) {
  try {
    // Check if phone number is valid (simple check)
    if (!data.phoneNumber || data.phoneNumber.length < 10) {
      console.log(`[WhatsApp] Invalid phone number for ${data.customerName}: ${data.phoneNumber}`);
      return;
    }

    // Format Message
    const message = formatWhatsAppMessage(data);

    // --------------------------------------------------------
    // APPROACH 1: TWILIO (RECOMMENDED - STANDARD)
    // --------------------------------------------------------
    // await sendViaTwilio(data.phoneNumber, message);

    // --------------------------------------------------------
    // APPROACH 2: WAHA / Local Gateway (Good for Self-Hosted)
    // --------------------------------------------------------
    // await sendViaWaha(data.phoneNumber, message);

    // --------------------------------------------------------
    // APPROACH 3: LOGGING (DEFAULT FOR NOW)
    // --------------------------------------------------------
    console.log("========================================");
    console.log(`[WhatsApp Mock] Sending to ${data.phoneNumber}`);
    console.log(message);
    console.log("========================================");

  } catch (error) {
    console.error("[WhatsApp] Failed to send notification:", error);
  }
}

// ------------------------------------------------------------
// HELPER: MESSAGE FORMATTER
// ------------------------------------------------------------

function formatWhatsAppMessage(data: OrderNotificationData): string {
  const itemsList = data.items
    .map((i) => `• ${i.productName}: ${i.quantity} x ${i.price}`)
    .join("\n");

  const walletList = data.bottleWallet.length > 0
    ? data.bottleWallet.map((w) => `• ${w.productName}: ${w.balance} bottles`).join("\n")
    : "No bottles held.";

  // Calculate balance text
  // Negative balance means debt (Payable by Customer) in this system
  // Positive means credit (Advance)
  const balanceVal = data.balance.current;
  const balanceText = balanceVal < 0
    ? `Payable: ${Math.abs(balanceVal)} ${data.balance.currency}`
    : `Advance Credit: ${balanceVal} ${data.balance.currency}`;

  return `
📦 *Order Delivered!*
Order #${data.readableId}

Hello ${data.customerName},
Your order has been successfully delivered.

*Order Details:*
${itemsList}
----------------
*Total: ${data.totalAmount} ${data.balance.currency}*

*Your Account:*
💰 Balance: ${balanceText}

*Bottle Wallet (With You):*
${walletList}

Thank you for your business!
`.trim();
}

// ------------------------------------------------------------
// PROVIDER IMPLEMENTATIONS (EXAMPLES)
// ------------------------------------------------------------

/*
// Option 1: Twilio Implementation
import twilio from "twilio"; // Requires 'npm install twilio'

async function sendViaTwilio(to: string, body: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER; // e.g. "whatsapp:+14155238886"

  if (!accountSid || !authToken || !fromNumber) {
    console.warn("Twilio credentials missing");
    return;
  }

  const client = twilio(accountSid, authToken);
  // Ensure 'to' has 'whatsapp:' prefix
  const toFormatted = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

  await client.messages.create({
    from: fromNumber,
    to: toFormatted,
    body: body,
  });
}
*/

/*
// Option 2: WAHA (WhatsApp HTTP API) - Self-Hosted Docker
async function sendViaWaha(to: string, body: string) {
  const apiUrl = process.env.WAHA_API_URL || "http://localhost:3000";
  const session = "default";

  // Waha expects numbers without '+' usually, check docs
  const chatId = `${to.replace("+", "")}@c.us`;

  await fetch(`${apiUrl}/api/sendText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session,
      chatId,
      text: body,
    }),
  });
}
*/
