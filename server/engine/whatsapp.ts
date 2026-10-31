import { Database as DatabaseType } from 'better-sqlite3';

export type WhatsAppWorkflowType = 'SHIP_AFTER_CONFIRMATION' | 'NUDGE_TO_PREPAID';

export type ConversationState =
  | 'AWAITING_CONFIRMATION'
  | 'CONFIRMED'
  | 'DECLINED'
  | 'OFFER_SENT'
  | 'AWAITING_PAYMENT'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'TIMEOUT';

export interface WhatsAppMessage {
  id: string;
  order_id: string;
  workflow_type: WhatsAppWorkflowType;
  sender: 'system' | 'customer';
  message_text: string;
  language: 'english' | 'hinglish';
  status: 'sent' | 'delivered' | 'read' | 'replied';
  metadata_json?: string;
  created_at: string;
}

export interface ConversationStatus {
  order_id: string;
  workflow_type: WhatsAppWorkflowType;
  state: ConversationState;
  language: 'english' | 'hinglish';
  offer_discount: number;
  payment_status: string | null;
  created_at: string;
  updated_at: string;
  timeout_at: string;
  messages: WhatsAppMessage[];
  order_status?: string;
}

export const MESSAGE_TEMPLATES = {
  confirmation: {
    english: (name: string, orderId: string, value: number, items: string) =>
      `Hi ${name}! Thank you for placing COD order #${orderId} of ₹${value.toLocaleString('en-IN')} for "${items}". Please reply YES to confirm your order for dispatch, or NO to cancel. — Team Store`,
    hinglish: (name: string, orderId: string, value: number, items: string) =>
      `Namaste ${name}! Aapka COD order #${orderId} (₹${value.toLocaleString('en-IN')}) humein mil gaya hai. Order dispatch karne ke liye kripya *YES* reply karein, ya cancel karne ke liye *NO* likhein. — Team Store`
  },
  prepaid_nudge: {
    english: (name: string, orderId: string, value: number, discount: number) =>
      `Special Offer for ${name}! Convert order #${orderId} to prepaid & get an INSTANT ₹${discount} DISCOUNT! Final payable: ₹${Math.max(0, value - discount).toLocaleString('en-IN')}. Reply PAY to get your payment link, or COD to keep cash on delivery.`,
    hinglish: (name: string, orderId: string, value: number, discount: number) =>
      `Khaas Offer ${name}! Order #${orderId} par instant ₹${discount} ki chhoot payein agar aap online pay karein! Final amount: ₹${Math.max(0, value - discount).toLocaleString('en-IN')}. Payment link ke liye *PAY* likhein, ya cash dene ke liye *COD* reply karein.`
  },
  clarification_confirmation: {
    english: `We didn't quite catch that. Please reply with *YES* to confirm your order, or *NO* to cancel.`,
    hinglish: `Humein samajh nahi aaya. Kripya order confirm karne ke liye *YES* ya cancel karne ke liye *NO* likhein.`
  },
  clarification_prepaid: {
    english: `Please reply with *PAY* to get the ₹{discount} discounted payment link, or *COD* to proceed without discount.`,
    hinglish: `Kripya discount lene ke liye *PAY* reply karein, ya cash par mangwane ke liye *COD* likhein.`
  },
  payment_link: {
    english: (orderId: string, payable: number) =>
      `Here is your secure instant checkout link for ₹${payable.toLocaleString('en-IN')}: https://pay.store.local/pay/${orderId} (Simulated). Complete payment within 15 minutes to secure your prepaid discount.`,
    hinglish: (orderId: string, payable: number) =>
      `Aapka secure payment link (₹${payable.toLocaleString('en-IN')}): https://pay.store.local/pay/${orderId} (Simulated). Discount lock karne ke liye agle 15 minutes mein payment karein.`
  },
  confirmed_thank_you: {
    english: `Thank you for confirming! Your order has been approved and packed for priority dispatch. Tracking details will be shared soon.`,
    hinglish: `Order confirm karne ke liye shukriya! Aapka parcel dispatch ke liye ready ho raha hai.`
  },
  declined_acknowledgment: {
    english: `Your order has been cancelled as per your request. No amount has been charged. Hope to see you again soon!`,
    hinglish: `Aapki request par order cancel kar diya gaya hai. Dhanyawad!`
  },
  payment_success_thank_you: {
    english: (orderId: string) =>
      `Payment Successful! Order #${orderId} is now 100% PREPAID. Your discount was applied. Priority shipping initiated!`,
    hinglish: (orderId: string) =>
      `Payment Successful! Order #${orderId} prepaid convert ho chuka hai. Parcel priority express se dispatch ho raha hai!`
  },
  payment_failure_alert: {
    english: `Payment failed or was interrupted. Would you like to retry online payment (reply RETRY) or switch back to standard COD (reply COD)?`,
    hinglish: `Payment fail ho gayi. Dobara koshish karne ke liye *RETRY* likhein ya COD par mangwane ke liye *COD* likhein.`
  },
  timeout_notice: {
    english: `Order cancelled automatically due to no buyer response within 24 hours.`,
    hinglish: `24 ghante mein response na aane par order automatically cancel kar diya gaya hai.`
  },
  already_confirmed: {
    english: `Your order is already confirmed and scheduled for dispatch. Tracking details will be sent soon!`,
    hinglish: `Aapka order pehle hi confirm ho chuka hai aur dispatch ke liye tayyar hai!`
  },
  already_declined: {
    english: `This order has already been cancelled upon your request. Please place a new order on our store if you need assistance.`,
    hinglish: `Yeh order pehle hi cancel ho chuka hai. Agar aapko dobara mangwana hai toh kripya nayi order place karein.`
  },
  expired_timeout: {
    english: `The confirmation window for this order has expired (24h timeout) and the order was cancelled. Please place a new order on our website.`,
    hinglish: `Confirmation ka samay (24 ghante) samapt ho chuka hai aur order cancel ho chuka hai. Kripya naya order karein.`
  },
  already_paid: {
    english: `Payment for this order has already been received successfully. Your parcel is on priority dispatch!`,
    hinglish: `Is order ki payment pehle hi safal ho chuki hai. Parcel priority se nikala ja raha hai!`
  }
};

export class WhatsAppSimulator {
  constructor(private db: DatabaseType) {}

  /**
   * Initializes or fetches a WhatsApp simulation for an order.
   */
  startWorkflow(
    orderId: string,
    workflowType: WhatsAppWorkflowType,
    language: 'english' | 'hinglish' = 'hinglish',
    discountAmount: number = 50
  ): ConversationStatus {
    const order = this.db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    if (!order) {
      throw new Error(`Order ${orderId} not found.`);
    }

    const existing = this.db
      .prepare('SELECT * FROM whatsapp_conversations WHERE order_id = ?')
      .get(orderId) as any;

    const now = new Date();
    const timeoutDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    if (!existing) {
      const initialState: ConversationState =
        workflowType === 'SHIP_AFTER_CONFIRMATION' ? 'AWAITING_CONFIRMATION' : 'OFFER_SENT';

      this.db
        .prepare(`
        INSERT INTO whatsapp_conversations
        (order_id, workflow_type, state, language, offer_discount, payment_status, created_at, updated_at, timeout_at)
        VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)
      `)
        .run(
          orderId,
          workflowType,
          initialState,
          language,
          discountAmount,
          now.toISOString(),
          now.toISOString(),
          timeoutDate.toISOString()
        );

      // Generate and store initial system message
      let initialMsg = '';
      if (workflowType === 'SHIP_AFTER_CONFIRMATION') {
        initialMsg =
          language === 'hinglish'
            ? MESSAGE_TEMPLATES.confirmation.hinglish(order.customer_name, order.id, order.order_value, order.items)
            : MESSAGE_TEMPLATES.confirmation.english(order.customer_name, order.id, order.order_value, order.items);
      } else {
        initialMsg =
          language === 'hinglish'
            ? MESSAGE_TEMPLATES.prepaid_nudge.hinglish(order.customer_name, order.id, order.order_value, discountAmount)
            : MESSAGE_TEMPLATES.prepaid_nudge.english(order.customer_name, order.id, order.order_value, discountAmount);
      }

      this.saveMessage(orderId, workflowType, 'system', initialMsg, language);
    }

    return this.getConversation(orderId);
  }

  /**
   * Processes a simulated customer reply.
   */
  processCustomerReply(orderId: string, userText: string): ConversationStatus {
    const conv = this.db
      .prepare('SELECT * FROM whatsapp_conversations WHERE order_id = ?')
      .get(orderId) as any;
    if (!conv) {
      throw new Error(`No active WhatsApp conversation found for order ${orderId}.`);
    }

    const order = this.db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    const text = userText.trim();
    const cleanLower = text.toLowerCase();
    const lang = conv.language as 'english' | 'hinglish';
    const now = new Date().toISOString();

    // Save customer message
    this.saveMessage(orderId, conv.workflow_type, 'customer', text, lang);

    // Terminal state handling (Duplicate replies & Expired confirmation)
    if (conv.state === 'CONFIRMED') {
      const msg = MESSAGE_TEMPLATES.already_confirmed[lang];
      this.saveMessage(orderId, conv.workflow_type, 'system', msg, lang);
      return this.getConversation(orderId);
    }

    if (conv.state === 'DECLINED') {
      const msg = MESSAGE_TEMPLATES.already_declined[lang];
      this.saveMessage(orderId, conv.workflow_type, 'system', msg, lang);
      return this.getConversation(orderId);
    }

    if (conv.state === 'TIMEOUT') {
      const msg = MESSAGE_TEMPLATES.expired_timeout[lang];
      this.saveMessage(orderId, conv.workflow_type, 'system', msg, lang);
      return this.getConversation(orderId);
    }

    if (conv.state === 'PAYMENT_SUCCESS') {
      const msg = MESSAGE_TEMPLATES.already_paid[lang];
      this.saveMessage(orderId, conv.workflow_type, 'system', msg, lang);
      return this.getConversation(orderId);
    }

    if (conv.workflow_type === 'SHIP_AFTER_CONFIRMATION') {
      const isYes = /\b(yes|y|ha|haa|haan|confirm|confirmed|ok|okay|dispatch|bhejo|send)\b/i.test(text);
      const isNo = /\b(no|n|nah|cancel|cancelled|nahi|mat bhejo|dont send|stop)\b/i.test(text);

      if (isYes && !isNo) {
        // Confirmed
        this.db
          .prepare(`
          UPDATE whatsapp_conversations
          SET state = 'CONFIRMED', updated_at = ?
          WHERE order_id = ?
        `)
          .run(now, orderId);

        // Update order status
        this.db.prepare(`UPDATE orders SET final_status = 'DELIVERED' WHERE id = ? AND final_status = 'IN_TRANSIT'`).run(orderId);

        const reply = MESSAGE_TEMPLATES.confirmed_thank_you[lang];
        this.saveMessage(orderId, conv.workflow_type, 'system', reply, lang);
      } else if (isNo) {
        // Declined
        this.db
          .prepare(`
          UPDATE whatsapp_conversations
          SET state = 'DECLINED', updated_at = ?
          WHERE order_id = ?
        `)
          .run(now, orderId);

        this.db.prepare(`UPDATE orders SET final_status = 'CANCELLED' WHERE id = ?`).run(orderId);

        const reply = MESSAGE_TEMPLATES.declined_acknowledgment[lang];
        this.saveMessage(orderId, conv.workflow_type, 'system', reply, lang);
      } else {
        // Ambiguous / random reply
        const clarification = MESSAGE_TEMPLATES.clarification_confirmation[lang];
        this.saveMessage(orderId, conv.workflow_type, 'system', clarification, lang);
      }
    } else if (conv.workflow_type === 'NUDGE_TO_PREPAID') {
      const isPay = /\b(pay|online|link|accept|upi|gpay|phonepe|card|retry)\b/i.test(text);
      const isCod = /\b(cod|cash|no|nahi|decline|cancel)\b/i.test(text);

      if (isPay && !isCod) {
        // Customer wants to pay online
        this.db
          .prepare(`
          UPDATE whatsapp_conversations
          SET state = 'AWAITING_PAYMENT', updated_at = ?
          WHERE order_id = ?
        `)
          .run(now, orderId);

        const payable = Math.max(0, order.order_value - conv.offer_discount);
        const linkMsg = MESSAGE_TEMPLATES.payment_link[lang](orderId, payable);
        this.saveMessage(orderId, conv.workflow_type, 'system', linkMsg, lang);
      } else if (isCod) {
        // Declined prepaid, prefers COD
        this.db
          .prepare(`
          UPDATE whatsapp_conversations
          SET state = 'DECLINED', updated_at = ?
          WHERE order_id = ?
        `)
          .run(now, orderId);

        const msg =
          lang === 'hinglish'
            ? `Koi baat nahi! Hum aapka order COD par hi process kar rahe hain. Delivery boy ko cash de dijiyega.`
            : `No problem! We will proceed with Cash on Delivery for ₹${order.order_value.toLocaleString('en-IN')}.`;
        this.saveMessage(orderId, conv.workflow_type, 'system', msg, lang);
      } else {
        // Ambiguous
        const clar = MESSAGE_TEMPLATES.clarification_prepaid[lang].replace('{discount}', conv.offer_discount.toString());
        this.saveMessage(orderId, conv.workflow_type, 'system', clar, lang);
      }
    }

    return this.getConversation(orderId);
  }

  /**
   * Simulates a mock payment gateway outcome (Success / Failure).
   */
  simulatePayment(orderId: string, outcome: 'SUCCESS' | 'FAILED'): ConversationStatus {
    const conv = this.db
      .prepare('SELECT * FROM whatsapp_conversations WHERE order_id = ?')
      .get(orderId) as any;
    if (!conv) {
      throw new Error(`Conversation not found for order ${orderId}`);
    }

    const lang = conv.language as 'english' | 'hinglish';
    const now = new Date().toISOString();

    if (outcome === 'SUCCESS') {
      this.db
        .prepare(`
        UPDATE whatsapp_conversations
        SET state = 'PAYMENT_SUCCESS', payment_status = 'COMPLETED', updated_at = ?
        WHERE order_id = ?
      `)
        .run(now, orderId);

      // Convert order to PREPAID in database
      this.db
        .prepare(`
        UPDATE orders
        SET payment_method = 'PREPAID',
            order_value = MAX(0, order_value - ?)
        WHERE id = ?
      `)
        .run(conv.offer_discount, orderId);

      const msg = MESSAGE_TEMPLATES.payment_success_thank_you[lang](orderId);
      this.saveMessage(orderId, conv.workflow_type, 'system', msg, lang);
    } else {
      this.db
        .prepare(`
        UPDATE whatsapp_conversations
        SET state = 'PAYMENT_FAILED', payment_status = 'FAILED', updated_at = ?
        WHERE order_id = ?
      `)
        .run(now, orderId);

      const msg = MESSAGE_TEMPLATES.payment_failure_alert[lang];
      this.saveMessage(orderId, conv.workflow_type, 'system', msg, lang);
    }

    return this.getConversation(orderId);
  }

  /**
   * Simulates a 24-hour timeout expiration.
   */
  simulateTimeout(orderId: string): ConversationStatus {
    const conv = this.db
      .prepare('SELECT * FROM whatsapp_conversations WHERE order_id = ?')
      .get(orderId) as any;
    if (!conv) {
      throw new Error(`Conversation not found for order ${orderId}`);
    }

    const lang = conv.language as 'english' | 'hinglish';
    const now = new Date().toISOString();

    this.db
      .prepare(`
      UPDATE whatsapp_conversations
      SET state = 'TIMEOUT', updated_at = ?
      WHERE order_id = ?
    `)
      .run(now, orderId);

    // Cancel order due to unresponsiveness
    this.db.prepare(`UPDATE orders SET final_status = 'CANCELLED' WHERE id = ?`).run(orderId);

    const msg = MESSAGE_TEMPLATES.timeout_notice[lang];
    this.saveMessage(orderId, conv.workflow_type, 'system', msg, lang);

    return this.getConversation(orderId);
  }

  /**
   * Retrieves conversation details and complete message history.
   */
  getConversation(orderId: string): ConversationStatus {
    const conv = this.db
      .prepare('SELECT * FROM whatsapp_conversations WHERE order_id = ?')
      .get(orderId) as any;
    if (!conv) {
      throw new Error(`No conversation for order ${orderId}`);
    }

    const order = this.db.prepare('SELECT final_status FROM orders WHERE id = ?').get(orderId) as any;

    const messages = this.db
      .prepare('SELECT * FROM whatsapp_messages WHERE order_id = ? ORDER BY created_at ASC')
      .all(orderId) as WhatsAppMessage[];

    return {
      order_id: conv.order_id,
      workflow_type: conv.workflow_type,
      state: conv.state,
      language: conv.language,
      offer_discount: conv.offer_discount,
      payment_status: conv.payment_status,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      timeout_at: conv.timeout_at,
      messages,
      order_status: order?.final_status
    };
  }

  private saveMessage(
    orderId: string,
    workflowType: WhatsAppWorkflowType,
    sender: 'system' | 'customer',
    text: string,
    language: 'english' | 'hinglish'
  ) {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.db
      .prepare(`
      INSERT INTO whatsapp_messages (id, order_id, workflow_type, sender, message_text, language, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'delivered', datetime('now'))
    `)
      .run(id, orderId, workflowType, sender, text, language);
  }
}
