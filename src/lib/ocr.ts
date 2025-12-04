interface VisionAPIResponse {
  responses: Array<{
    textAnnotations?: Array<{
      description: string;
      boundingPoly: {
        vertices: Array<{ x: number; y: number }>;
      };
    }>;
    fullTextAnnotation?: {
      text: string;
    };
    error?: {
      code: number;
      message: string;
    };
  }>;
}

interface ParsedBusinessCard {
  name: string | null;
  name_kana: string | null;
  company_name: string | null;
  department: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  fax: string | null;
  postal_code: string | null;
  address: string | null;
  website: string | null;
}

export async function performOCR(imageBase64: string): Promise<string> {
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  if (!apiKey) {
    throw new Error("Google Cloud API key is not configured");
  }

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: imageBase64,
            },
            features: [
              {
                type: "TEXT_DETECTION",
                maxResults: 1,
              },
            ],
            imageContext: {
              languageHints: ["ja", "en"],
            },
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Vision API error: ${response.statusText}`);
  }

  const data: VisionAPIResponse = await response.json();

  if (data.responses[0]?.error) {
    throw new Error(data.responses[0].error.message);
  }

  return data.responses[0]?.fullTextAnnotation?.text ?? "";
}

export function parseBusinessCardText(text: string): ParsedBusinessCard {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);

  const result: ParsedBusinessCard = {
    name: null,
    name_kana: null,
    company_name: null,
    department: null,
    position: null,
    email: null,
    phone: null,
    mobile: null,
    fax: null,
    postal_code: null,
    address: null,
    website: null,
  };

  // Email pattern
  const emailPattern = /[\w.-]+@[\w.-]+\.\w+/;
  // Phone patterns
  const phonePattern = /(?:TEL|電話|Tel|tel)?[:\s]*((?:\d{2,4}[-\s]?\d{2,4}[-\s]?\d{3,4})|(?:\(\d{2,4}\)\s?\d{2,4}[-\s]?\d{3,4}))/i;
  const mobilePattern = /(?:携帯|Mobile|mobile|HP)?[:\s]*(090|080|070)[-\s]?\d{4}[-\s]?\d{4}/i;
  const faxPattern = /(?:FAX|Fax|fax)[:\s]*(\d{2,4}[-\s]?\d{2,4}[-\s]?\d{3,4})/i;
  // Postal code pattern
  const postalPattern = /〒?\s*(\d{3}[-\s]?\d{4})/;
  // URL pattern
  const urlPattern = /(?:https?:\/\/)?(?:www\.)?[\w.-]+\.\w{2,}(?:\/\S*)?/i;
  // Katakana pattern for name_kana
  const katakanaPattern = /^[\u30A0-\u30FF\s]+$/;
  // Common position keywords
  const positionKeywords = ["代表", "社長", "取締役", "部長", "課長", "係長", "主任", "マネージャー", "ディレクター", "CEO", "CTO", "CFO", "COO"];
  // Common department keywords
  const departmentKeywords = ["部", "課", "室", "グループ", "チーム", "センター"];

  for (const line of lines) {
    // Email
    const emailMatch = line.match(emailPattern);
    if (emailMatch && !result.email) {
      result.email = emailMatch[0];
      continue;
    }

    // FAX (check before phone)
    const faxMatch = line.match(faxPattern);
    if (faxMatch && !result.fax) {
      result.fax = faxMatch[1].replace(/\s/g, "");
      continue;
    }

    // Mobile
    const mobileMatch = line.match(mobilePattern);
    if (mobileMatch && !result.mobile) {
      result.mobile = mobileMatch[0].replace(/[^\d-]/g, "");
      continue;
    }

    // Phone
    const phoneMatch = line.match(phonePattern);
    if (phoneMatch && !result.phone && !line.match(faxPattern)) {
      result.phone = phoneMatch[1].replace(/\s/g, "");
      continue;
    }

    // Postal code
    const postalMatch = line.match(postalPattern);
    if (postalMatch && !result.postal_code) {
      result.postal_code = postalMatch[1].replace(/\s/g, "");
      continue;
    }

    // URL
    const urlMatch = line.match(urlPattern);
    if (urlMatch && !result.website && !line.includes("@")) {
      result.website = urlMatch[0];
      continue;
    }
  }

  // Address detection (after postal code)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(postalPattern) && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      if (!nextLine.match(emailPattern) && !nextLine.match(phonePattern)) {
        result.address = nextLine;
        break;
      }
    }
    // Also check for address patterns
    if (!result.address && (line.includes("都") || line.includes("道") || line.includes("府") || line.includes("県"))) {
      if (!line.match(emailPattern) && !line.match(phonePattern)) {
        result.address = line;
      }
    }
  }

  // Company, Position, Department, Name detection
  for (const line of lines) {
    // Skip if already identified as contact info
    if (
      line.match(emailPattern) ||
      line.match(phonePattern) ||
      line.match(faxPattern) ||
      line.match(postalPattern) ||
      line.match(urlPattern) ||
      line === result.address
    ) {
      continue;
    }

    // Katakana line is likely name_kana
    if (katakanaPattern.test(line) && !result.name_kana) {
      result.name_kana = line;
      continue;
    }

    // Check for position
    if (!result.position && positionKeywords.some((kw) => line.includes(kw))) {
      result.position = line;
      continue;
    }

    // Check for department
    if (!result.department && departmentKeywords.some((kw) => line.includes(kw))) {
      result.department = line;
      continue;
    }

    // Check for company (usually contains 株式会社, 有限会社, etc.)
    if (!result.company_name && (line.includes("株式会社") || line.includes("有限会社") || line.includes("合同会社") || line.includes("Inc.") || line.includes("Co.,") || line.includes("Corp"))) {
      result.company_name = line;
      continue;
    }
  }

  // Try to identify name (usually first non-matched line with Japanese characters)
  for (const line of lines) {
    if (
      !result.name &&
      line !== result.company_name &&
      line !== result.department &&
      line !== result.position &&
      line !== result.name_kana &&
      line !== result.address &&
      !line.match(emailPattern) &&
      !line.match(phonePattern) &&
      !line.match(faxPattern) &&
      !line.match(postalPattern) &&
      !line.match(urlPattern)
    ) {
      // Check if it looks like a name (2-4 characters, contains kanji)
      const kanjiPattern = /[\u4E00-\u9FAF]/;
      if (line.length >= 2 && line.length <= 10 && kanjiPattern.test(line)) {
        result.name = line.replace(/\s+/g, " ");
        break;
      }
    }
  }

  return result;
}
