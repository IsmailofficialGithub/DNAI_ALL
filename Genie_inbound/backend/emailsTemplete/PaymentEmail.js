export const PaymentEmail = (name, amount, status, type, invoiceId) => {
  const isSuccess = status === 'success' || status === 'paid' || status === 'approved';
  const title = isSuccess ? 'Payment Successful' : 'Payment Failed';
  const primaryColor = isSuccess ? '#00B48D' : '#FF4B4B';
  const statusText = isSuccess ? 'Processed Successfully' : 'Action Required';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<title>${title} - DuhaNashrah ai</title>
<!--[if mso]>
<noscript>
  <xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml>
</noscript>
<![endif]-->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style type="text/css">
  /* RESET */
  * { box-sizing: border-box; }
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
  img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
  body { margin: 0 !important; padding: 0 !important; background-color: #f4f5f7; width: 100% !important; }

  /* MOBILE */
  @media only screen and (max-width: 620px) {
    .wrapper-td    { padding: 20px 10px !important; }
    .main-table    { width: 100% !important; }
    .header-td     { padding: 20px 20px 10px !important; }
    .logo-td       { display: block !important; width: 100% !important; text-align: center !important; padding-bottom: 10px !important; }
    .contact-td    { display: block !important; width: 100% !important; text-align: center !important; }
    .content-td    { padding: 20px !important; }
    .title-h1      { font-size: 20px !important; }
    .fi-left       { width: 90px !important; }
    .fi-right      { width: 120px !important; }
  }
  @media only screen and (max-width: 400px) {
    .fi-left  { width: 70px !important; }
    .fi-right { width: 95px !important; }
    .title-h1 { font-size: 18px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;width:100%;">

<!-- Outer wrapper -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f4f5f7">
  <tr>
    <td class="wrapper-td" align="center" style="padding:40px 20px;">

      <!-- Main card -->
      <table role="presentation" class="main-table" width="600" cellspacing="0" cellpadding="0" border="0"
             style="background-color:#ffffff;border-radius:12px;max-width:600px;width:100%;">

        <!-- ====== HEADER ====== -->
        <tr>
          <td class="header-td" style="padding:30px 40px 10px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td class="logo-td" valign="middle">
                  <img src="https://lblkjhlojjlwqmwfnels.supabase.co/storage/v1/object/public/styling-image/DnaiLogo.png"
                       alt="DuhaNashrah ai" height="45"
                       style="height:45px;width:auto;display:block;" />
                </td>
                <td class="contact-td" valign="middle" align="right">
                  <a href="#"
                     style="color:#00B48D;text-decoration:none;font-size:15px;font-weight:600;font-family:'Manrope',Arial,sans-serif;">
                    Contact Us
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ====== CONTENT ====== -->
        <tr>
          <td class="content-td" style="padding:20px 40px;">

            <!-- Status Badge -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td align="center" style="padding-bottom:14px;">
                  <!--[if mso]><table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"><tr><td style="border-radius:20px;background-color:${primaryColor}18;padding:6px 16px;"><![endif]-->
                  <span style="display:inline-block;padding:6px 16px;background-color:${primaryColor}18;color:${primaryColor};border-radius:20px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;font-family:'Manrope',Arial,sans-serif;mso-hide:none;">
                    ${statusText}
                  </span>
                  <!--[if mso]></td></tr></table><![endif]-->
                </td>
              </tr>
            </table>

            <!-- Title -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td align="center" style="padding-bottom:20px;">
                  <h1 class="title-h1"
                      style="margin:0;font-size:24px;font-weight:700;color:#111111;font-family:'Manrope',Arial,sans-serif;text-align:center;mso-line-height-rule:exactly;line-height:32px;">
                    ${title}
                  </h1>
                </td>
              </tr>
            </table>

            <!-- Greeting -->
            <p style="margin:0 0 15px 0;font-size:16px;color:#333333;font-family:'Manrope',Arial,sans-serif;">
              Hello ${name || "User"},
            </p>

            <!-- Message -->
            <p style="margin:0 0 25px 0;font-size:16px;line-height:1.6;color:#444444;font-family:'Manrope',Arial,sans-serif;">
              ${isSuccess
      ? `We've successfully processed your payment for ${type === 'credits' ? 'credits' : 'your subscription package'}.`
      : `We encountered an issue while processing your payment. Please update your payment method to avoid any service interruption.`}
            </p>

            <!-- ====== TRANSACTION DETAILS BOX ====== -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                   bgcolor="#F1F1F1"
                   style="background-color:#F1F1F1;border-radius:8px;margin-bottom:25px;">
              <tr>
                <td style="padding:20px 25px;">

                  <!-- Amount -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="font-size:15px;color:#6b7280;font-weight:500;font-family:'Manrope',Arial,sans-serif;
                                 padding:8px 0;border-bottom:1px solid #e5e7eb;">
                        Amount Paid
                      </td>
                      <td align="right"
                          style="font-size:15px;color:#111111;font-weight:700;font-family:'Manrope',Arial,sans-serif;
                                 padding:8px 0;border-bottom:1px solid #e5e7eb;">
                        $${parseFloat(amount).toFixed(2)}
                      </td>
                    </tr>
                  </table>

                  <!-- Invoice ID (conditional) -->
                  ${invoiceId ? `
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="font-size:15px;color:#6b7280;font-weight:500;font-family:'Manrope',Arial,sans-serif;
                                 padding:8px 0;border-bottom:1px solid #e5e7eb;">
                        Invoice ID
                      </td>
                      <td align="right"
                          style="font-size:15px;color:#111111;font-weight:700;font-family:'Manrope',Arial,sans-serif;
                                 padding:8px 0;border-bottom:1px solid #e5e7eb;">
                        #${invoiceId.split('-')[0].toUpperCase()}
                      </td>
                    </tr>
                  </table>` : ''}

                  <!-- Date -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="font-size:15px;color:#6b7280;font-weight:500;font-family:'Manrope',Arial,sans-serif;
                                 padding:8px 0;border-bottom:1px solid #e5e7eb;">
                        Date
                      </td>
                      <td align="right"
                          style="font-size:15px;color:#111111;font-weight:700;font-family:'Manrope',Arial,sans-serif;
                                 padding:8px 0;border-bottom:1px solid #e5e7eb;">
                        ${new Date().toLocaleDateString()}
                      </td>
                    </tr>
                  </table>

                  <!-- Status (no bottom border) -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="font-size:15px;color:#6b7280;font-weight:500;font-family:'Manrope',Arial,sans-serif;padding:8px 0 0 0;">
                        Status
                      </td>
                      <td align="right"
                          style="font-size:15px;font-weight:700;color:${primaryColor};font-family:'Manrope',Arial,sans-serif;padding:8px 0 0 0;">
                        ${status.toUpperCase()}
                      </td>
                    </tr>
                  </table>

                </td>
              </tr>
            </table>
            <!-- /Transaction details box -->

            <!-- Help Text -->
            <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#555555;font-family:'Manrope',Arial,sans-serif;">
              If you have any questions about this transaction, please
              <a href="#" style="color:#00B48D;text-decoration:none;font-weight:500;">Contact Us</a>.
              If you did not make this request, please reach out to us immediately.
            </p>

            <!-- CTA Button -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                   style="margin-bottom:30px;">
              <tr>
                <td align="center">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                    href="${process.env.FRONTEND_URL || '#'}/billing"
                    style="height:46px;v-text-anchor:middle;width:210px;" arcsize="13%"
                    fillcolor="#00B48D" strokecolor="#00B48D">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:'Manrope',Arial,sans-serif;font-size:15px;font-weight:600;">
                      View Billing History
                    </center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <a href="${process.env.FRONTEND_URL || '#'}/billing"
                     style="display:inline-block;background-color:#00B48D;color:#ffffff;padding:13px 28px;
                            border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;
                            font-family:'Manrope',Arial,sans-serif;mso-hide:all;">
                    View Billing History
                  </a>
                  <!--<![endif]-->
                </td>
              </tr>
            </table>

            <!-- Signature -->
            <p style="margin:0 0 40px 0;font-size:16px;line-height:1.6;color:#444444;font-family:'Manrope',Arial,sans-serif;">
              Thank you for choosing DuhaNashrah AI,<br>The DuhaNashrah Team
            </p>

          </td>
        </tr>

        <!-- ====== FOOTER CHARACTER IMAGES ====== -->
        <tr>
          <td style="padding:0;font-size:0;line-height:0;mso-line-height-rule:exactly;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td valign="bottom" align="left" style="padding:0 0 0 20px;font-size:0;line-height:0;mso-line-height-rule:exactly;">
                  <img src="https://lblkjhlojjlwqmwfnels.supabase.co/storage/v1/object/public/styling-image/beeba.png"
                       alt="" class="fi-left"
                       style="width:150px;max-width:150px;height:auto;display:block;vertical-align:bottom;" />
                </td>
                <td valign="bottom" align="right" style="padding:0;font-size:0;line-height:0;mso-line-height-rule:exactly;">
                  <img src="https://lblkjhlojjlwqmwfnels.supabase.co/storage/v1/object/public/styling-image/genie.png"
                       alt="" class="fi-right"
                       style="width:320px;max-width:320px;height:auto;display:block;vertical-align:bottom;" />
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ====== GREEN FOOTER ====== -->
        <tr>
          <td style="padding:0;mso-line-height-rule:exactly;border-bottom-left-radius:12px;border-bottom-right-radius:12px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td bgcolor="#00B48D" align="center"
                    style="background-color:#00B48D;
                           padding:40px 20px 25px;
                           border-top-left-radius:50% 60px;
                           border-top-right-radius:50% 60px;
                           border-bottom-left-radius:12px;
                           border-bottom-right-radius:12px;
                           mso-border-radius-topright:0;
                           mso-border-radius-topleft:0;
                           mso-border-radius-bottomright:12px;
                           mso-border-radius-bottomleft:12px;">

                  <!-- Footer logo name -->
                  <p style="margin:0 0 15px 0;font-size:20px;font-weight:700;color:#ffffff;
                            font-family:'Manrope',Arial,sans-serif;text-align:center;">
                    DuhaNashrah ai
                  </p>

                  <!-- Social icons -->
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"
                         style="margin:0 auto 15px auto;">
                    <tr>
                      <td style="padding:0 8px;">
                        <a href="#" style="text-decoration:none;display:block;">
                          <img src="https://img.icons8.com/ios-filled/50/ffffff/facebook-new.png"
                               alt="Facebook" width="30" height="30"
                               style="width:30px;height:30px;display:block;border:0;" />
                        </a>
                      </td>
                      <td style="padding:0 8px;">
                        <a href="#" style="text-decoration:none;display:block;">
                          <img src="https://img.icons8.com/ios-filled/50/ffffff/twitter.png"
                               alt="Twitter" width="30" height="30"
                               style="width:30px;height:30px;display:block;border:0;" />
                        </a>
                      </td>
                      <td style="padding:0 8px;">
                        <a href="#" style="text-decoration:none;display:block;">
                          <img src="https://img.icons8.com/ios-filled/50/ffffff/instagram-new.png"
                               alt="Instagram" width="30" height="30"
                               style="width:30px;height:30px;display:block;border:0;" />
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Copyright -->
                  <p style="margin:0;font-size:14px;color:#ffffff;font-family:'Manrope',Arial,sans-serif;
                            text-align:center;opacity:0.9;">
                    © 2026 DuhaNashrah ai
                  </p>

                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
      <!-- /Main card -->

    </td>
  </tr>
</table>
<!-- /Outer wrapper -->

</body>
</html>`;
};
