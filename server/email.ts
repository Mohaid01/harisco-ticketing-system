/**
 * Email notification service.
 * Simulates email delivery by logging formatted messages to the console.
 */
export async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  if (!to) {
    console.log(`[Email Service] Skipped sending email: "to" address is empty. (Subject: "${subject}")`);
    return false;
  }
  
  console.log(`
=========================================
📧 EMAIL SENT OUT (SIMULATION)
To:      ${to}
Subject: ${subject}
Date:    ${new Date().toLocaleString()}
-----------------------------------------
${body}
=========================================
  `);
  return true;
}
