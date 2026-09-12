export type EmailDesignStyle = "modern" | "classic" | "minimal" | "newsletter" | "corporate";

export interface EmailDesignOptions {
  previewMode?: boolean;
  fullWidthPreview?: boolean;
  style?: EmailDesignStyle;
  accentColor?: string;
  companyName?: string;
  headerVariation?: number; // 0-2 for different header styles
}

export const DESIGN_STYLES = [
  { value: "modern", label: "Modern", description: "Clean and contemporary design" },
  { value: "classic", label: "Classic", description: "Traditional business style" },
  { value: "minimal", label: "Minimal", description: "Simple and focused" },
  { value: "newsletter", label: "Newsletter", description: "Content-rich layout" },
  { value: "corporate", label: "Corporate", description: "Professional and formal" },
] as const;

export const ACCENT_COLORS = [
  { value: "#4F46E5", label: "Indigo" },
  { value: "#00c19c", label: "Teal" },
  { value: "#10B981", label: "Green" },
  { value: "#F59E0B", label: "Amber" },
  { value: "#EF4444", label: "Red" },
  { value: "#8B5CF6", label: "Purple" },
  { value: "#EC4899", label: "Pink" },
  { value: "#06B6D4", label: "Cyan" },
] as const;

const getStyleCSS = (style: EmailDesignStyle, accentColor: string): string => {
  const baseStyles = {
    modern: `
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
    `,
    classic: `
      font-family: Georgia, 'Times New Roman', serif;
      line-height: 1.8;
      color: #374151;
    `,
    minimal: `
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      color: #111827;
    `,
    newsletter: `
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.7;
      color: #1f2937;
    `,
    corporate: `
      font-family: 'Arial', 'Helvetica', sans-serif;
      line-height: 1.6;
      color: #1f2937;
    `,
  };

  return baseStyles[style] || baseStyles.modern;
};

const getLayoutHTML = (
  style: EmailDesignStyle,
  accentColor: string,
  companyName?: string,
  headerVariation: number = 0
): { header: string; footer: string } => {
  const headerContent = companyName || "";

  // Generate header variations based on headerVariation parameter
  const getModernHeader = (variation: number) => {
    if (!headerContent) return '';
    const variations = [
      `<div style="background: linear-gradient(135deg, ${accentColor} 0%, ${accentColor}dd 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;"><h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">${headerContent}</h1></div>`,
      `<div style="background: ${accentColor}; padding: 25px; text-align: center; border-radius: 10px 10px 0 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"><h1 style="color: white; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 0.5px;">${headerContent}</h1></div>`,
      `<div style="background: linear-gradient(90deg, ${accentColor} 0%, ${accentColor}cc 50%, ${accentColor} 100%); padding: 28px; text-align: center; border-radius: 10px 10px 0 0;"><h1 style="color: white; margin: 0; font-size: 27px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">${headerContent}</h1></div>`,
    ];
    return variations[variation % variations.length];
  };

  const getClassicHeader = (variation: number) => {
    if (!headerContent) return '';
    const variations = [
      `<div style="background: ${accentColor}; padding: 25px; text-align: center; border-bottom: 3px solid ${accentColor}dd;"><h1 style="color: white; margin: 0; font-size: 24px; font-weight: 500; letter-spacing: 1px;">${headerContent}</h1></div>`,
      `<div style="background: ${accentColor}; padding: 30px; text-align: center; border-bottom: 4px solid ${accentColor}aa;"><h1 style="color: white; margin: 0; font-size: 25px; font-weight: 600; font-style: italic;">${headerContent}</h1></div>`,
      `<div style="background: ${accentColor}; padding: 22px; text-align: center; border-bottom: 2px solid ${accentColor}ee;"><h1 style="color: white; margin: 0; font-size: 23px; font-weight: 400; letter-spacing: 2px;">${headerContent}</h1></div>`,
    ];
    return variations[variation % variations.length];
  };

  const getMinimalHeader = (variation: number) => {
    if (!headerContent) return '';
    const variations = [
      `<div style="padding: 20px 0; text-align: center; border-bottom: 1px solid #e5e7eb;"><h1 style="color: ${accentColor}; margin: 0; font-size: 24px; font-weight: 300; letter-spacing: 2px;">${headerContent}</h1></div>`,
      `<div style="padding: 25px 0; text-align: center; border-bottom: 2px solid ${accentColor}33;"><h1 style="color: ${accentColor}; margin: 0; font-size: 22px; font-weight: 400;">${headerContent}</h1></div>`,
      `<div style="padding: 18px 0; text-align: center; border-bottom: 1px dashed #d1d5db;"><h1 style="color: ${accentColor}; margin: 0; font-size: 26px; font-weight: 200; letter-spacing: 3px;">${headerContent}</h1></div>`,
    ];
    return variations[variation % variations.length];
  };

  const getNewsletterHeader = (variation: number) => {
    if (!headerContent) return '';
    const variations = [
      `<div style="background: ${accentColor}; padding: 35px; text-align: center;"><h1 style="color: white; margin: 0; font-size: 32px; font-weight: 700;">${headerContent}</h1><p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Newsletter</p></div>`,
      `<div style="background: linear-gradient(135deg, ${accentColor} 0%, ${accentColor}dd 100%); padding: 40px; text-align: center;"><h1 style="color: white; margin: 0; font-size: 30px; font-weight: 800;">${headerContent}</h1><p style="color: rgba(255,255,255,0.85); margin: 12px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Newsletter</p></div>`,
      `<div style="background: ${accentColor}; padding: 32px; text-align: center; border-bottom: 2px solid rgba(255,255,255,0.2);"><h1 style="color: white; margin: 0; font-size: 34px; font-weight: 600;">${headerContent}</h1><p style="color: rgba(255,255,255,0.95); margin: 8px 0 0 0; font-size: 15px; font-weight: 500;">Newsletter</p></div>`,
    ];
    return variations[variation % variations.length];
  };

  const getCorporateHeader = (variation: number) => {
    if (!headerContent) return '';
    const variations = [
      `<div style="background: #1f2937; padding: 25px; text-align: left; border-left: 4px solid ${accentColor};"><h1 style="color: white; margin: 0; font-size: 22px; font-weight: 600;">${headerContent}</h1></div>`,
      `<div style="background: #111827; padding: 28px; text-align: center; border-bottom: 3px solid ${accentColor};"><h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">${headerContent}</h1></div>`,
      `<div style="background: #1f2937; padding: 22px 30px; text-align: left; border-left: 5px solid ${accentColor}; border-top: 1px solid ${accentColor}33;"><h1 style="color: white; margin: 0; font-size: 21px; font-weight: 500; letter-spacing: 0.5px;">${headerContent}</h1></div>`,
    ];
    return variations[variation % variations.length];
  };

  const variation = headerVariation || 0;

  switch (style) {
    case "modern":
      return {
        header: getModernHeader(variation),
        footer: `
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} ${headerContent}. All rights reserved.
            </p>
          </div>
        `,
      };
    case "classic":
      return {
        header: getClassicHeader(variation),
        footer: headerContent ? `
          <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #d1d5db; text-align: center;">
            <p style="color: #6b7280; font-size: 13px; margin: 0; font-style: italic;">
              © ${new Date().getFullYear()} ${headerContent}
            </p>
          </div>
        ` : '',
      };
    case "minimal":
      return {
        header: getMinimalHeader(variation),
        footer: headerContent ? `
          <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #f3f4f6; text-align: center;">
            <p style="color: #9ca3af; font-size: 11px; margin: 0;">${headerContent}</p>
          </div>
        ` : '',
      };
    case "newsletter":
      return {
        header: getNewsletterHeader(variation),
        footer: headerContent ? `
          <div style="margin-top: 50px; padding: 25px; background: #f9fafb; text-align: center; border-radius: 0 0 10px 10px;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} ${headerContent} | <a href="#" style="color: ${accentColor}; text-decoration: none;">Unsubscribe</a>
            </p>
          </div>
        ` : '',
      };
    case "corporate":
      return {
        header: getCorporateHeader(variation),
        footer: headerContent ? `
          <div style="margin-top: 40px; padding: 20px; background: #f3f4f6; text-align: center;">
            <p style="color: #4b5563; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} ${headerContent}. All rights reserved.
            </p>
          </div>
        ` : '',
      };
    default:
      return {
        header: headerContent ? `<div style="padding: 20px; background: ${accentColor}; color: white; text-align: center;"><h1 style="margin: 0;">${headerContent}</h1></div>` : '',
        footer: headerContent ? `<div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;"><p style="margin: 0;">© ${new Date().getFullYear()} ${headerContent}</p></div>` : '',
      };
  }
};

export const convertToHtmlEmail = (
  subject: string,
  body: string,
  options: EmailDesignOptions = {}
): string => {
  const {
    previewMode = false,
    fullWidthPreview = false,
    style = "modern",
    accentColor = "#4F46E5",
    companyName,
  } = options;

  const styleCSS = getStyleCSS(style, accentColor);
  const { header, footer } = getLayoutHTML(style, accentColor, companyName, options.headerVariation);

  // Convert line breaks to <br> and preserve basic formatting
  const formattedBody = body
    .replace(/\n/g, "<br>")
    .replace(/\{\{([^}]+)\}\}/g, '<span style="background: #fef3c7; padding: 2px 4px; border-radius: 3px;">{{$1}}</span>');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body {
            ${styleCSS}
            max-width: ${fullWidthPreview ? "100%" : "600px"};
            margin: ${fullWidthPreview ? "0" : "0 auto"};
            padding: ${previewMode ? "0" : "20px"};
          }
          .email-container {
            background: #ffffff;
            border: ${previewMode ? "none" : "1px solid #e5e7eb"};
            border-radius: ${previewMode ? "0" : "10px"};
            overflow: hidden;
            box-shadow: ${previewMode ? "none" : "0 1px 3px rgba(0,0,0,0.1)"};
          }
          .email-content {
            padding: 40px;
          }
          a {
            color: ${accentColor};
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          ${header}
          <div class="email-content">
            ${formattedBody}
          </div>
          ${footer}
        </div>
      </body>
    </html>
  `;

  return html;
};
