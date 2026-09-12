export const WellcomeEmail = (name, dashboardUrl) => {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome - DuhaNashrah ai</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  body {
    margin: 0;
    padding: 0;
    background-color: #f4f5f7;
    font-family: 'Manrope', Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: #333333;
  }
  .wrapper {
    width: 100%;
    table-layout: fixed;
    background-color: #f4f5f7;
    padding: 40px 20px;
    box-sizing: border-box;
    font-family: 'Manrope', Arial, sans-serif;
  }
  .main-container {
    max-width: 600px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
    font-family: 'Manrope', Arial, sans-serif;
  }
  .header {
    padding: 30px 40px 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .contact-btn {
    color: #00B48D;
    text-decoration: none;
    font-size: 15px;
    font-weight: 600;
  }
  .content {
    padding: 20px 40px;
  }
  .title {
    text-align: center;
    font-size: 24px;
    font-weight: 700;
    color: #111111;
    margin: 0 0 30px 0;
  }
  .greeting {
    font-size: 16px;
    margin-bottom: 15px;
  }
  .message {
    font-size: 16px;
    line-height: 1.6;
    margin-bottom: 25px;
    color: #444444;
  }
  .help-text {
    font-size: 15px;
    line-height: 1.6;
    color: #555555;
    margin-bottom: 20px;
  }
  .link {
    color: #00B48D;
    text-decoration: none;
    font-weight: 500;
  }
  .signature {
    font-size: 16px;
    line-height: 1.6;
    color: #444444;
    margin-bottom: 40px;
  }
  .footer-area {
    position: relative;
    background-color: #ffffff;
    margin-top: 20px;
  }
  .green-footer {
    background-color: #00B48D;
    padding: 30px 20px 25px;
    text-align: center;
    color: #ffffff;
    position: relative;
    overflow: hidden;
    border-top-left-radius: 90% 100%;
    border-top-right-radius: 90% 100% ;
    border-bottom-left-radius: 12px;
    border-bottom-right-radius: 12px;
  }
  .footer-img-left {
    width: 150px;
    max-width: 100%;
    height: auto;
    display: block;
  }
  .footer-img-right {
    width: 320px;
    max-width: 100%;
    height: auto;
    display: block;
  }
  .footer-cell-left {
    padding-left: 20px;
  }
  .footer-cell-right {
    padding-right: -20px;
  }
  .footer-logo {
    font-family: 'Manrope', Arial, sans-serif;
    font-size: 20px;
    font-weight: 700;
    margin: 0 0 15px 0;
  }
  .social-icons {
    text-align: center;
    margin-bottom: 15px;
  }
  .social-icon {
    display: inline-block;
    text-align: center;
    line-height: 32px;
    color: #ffffff;
    text-decoration: none;
    margin: 0 8px;
  }
  .social-icon img {
    width: 30px;
    height: 30px;
    vertical-align: middle;
    border: 0;
    display: inline-block;
    margin-top: -3px;
  }
  .copyright {
    font-size: 14px;
    opacity: 0.9;
  }
</style>
</head>
<body>
<div class="wrapper">
  <div class="main-container">
    <div class="header">
      <div class="logo">
        <img src="https://lblkjhlojjlwqmwfnels.supabase.co/storage/v1/object/public/styling-image/DnaiLogo.png" style="height: 45px;" />
      </div>
      <a href="#" class="contact-btn">Contact Us</a>
    </div>

    <div class="content">
      <h1 class="title">Welcome to DuhaNashrah AI</h1>

      <div class="greeting">Hello ${name || ""},</div>

      <div class="message">
        Your account has been successfully created. We're excited to have you on board.
      </div>

      <div class="message">
        You can now start exploring our platform and unlock powerful AI features designed to boost your productivity.
      </div>

      <div class="help-text">
        Click below to access your dashboard and get started:
      </div>

      <div style="text-align:center;margin-bottom:30px;">
        <a href="${dashboardUrl || "#"}" style="background:#00B48D;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
          Go to Dashboard
        </a>
      </div>

      <div class="help-text">
        If you did not create this account, you can safely ignore this email.
      </div>

      <div class="signature">
        Thank you,<br>The DuhaNashrah Team
      </div>
    </div>

    <div class="footer-area">
      <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: -50px; position: relative; z-index: 10;">
        <tr>
          <td align="left" valign="bottom" class="footer-cell-left">
            <img src="https://lblkjhlojjlwqmwfnels.supabase.co/storage/v1/object/public/styling-image/beeba.png" class="footer-img-left" />
          </td>
          <td align="right" valign="bottom" class="footer-cell-right">
            <img src="https://lblkjhlojjlwqmwfnels.supabase.co/storage/v1/object/public/styling-image/genie.png" class="footer-img-right" />
          </td>
        </tr>
      </table>

      <div class="green-footer">
        <h2 class="footer-logo">DuhaNashrah ai</h2>

        <div class="social-icons">
          <a href="#" class="social-icon"><img src="https://img.icons8.com/ios-filled/50/ffffff/facebook-new.png" /></a>
          <a href="#" class="social-icon"><img src="https://img.icons8.com/ios-filled/50/ffffff/twitter.png" /></a>
          <a href="#" class="social-icon"><img src="https://img.icons8.com/ios-filled/50/ffffff/instagram-new.png" /></a>
        </div>

        <div class="copyright">© 2026 DuhaNashrah ai</div>
      </div>
    </div>

  </div>
</div>
</body>
</html>
  `;
};