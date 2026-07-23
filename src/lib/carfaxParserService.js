import fs from 'fs';
import path from 'path';
import PDFParser from 'pdf2json';
import pdfParse from 'pdf-parse';
import { pdfToPng } from 'pdf-to-png-converter';
import Tesseract from 'tesseract.js';

/**
 * CARFAX PDF Parser Service
 * Extracts key information from CARFAX PDF reports
 */
class CarfaxParserService {
  
  /**
   * Parse CARFAX PDF and extract key information
   * @param {Buffer} pdfBuffer - PDF file buffer
   * @returns {Object} Parsed CARFAX data
   */
  async parseCarfaxPDF(pdfBuffer) {
    try {
      console.log('🔍 Parsing CARFAX PDF...');
      
      // Try pdf-parse first (more reliable for text extraction)
      let text = '';
      try {
        console.log('📄 Attempting to parse with pdf-parse...');
        const pdfData = await pdfParse(pdfBuffer);
        text = pdfData.text;
        console.log(`📄 pdf-parse extracted ${text.length} characters`);
        console.log('📄 First 500 characters from pdf-parse:', text.substring(0, 500));
      } catch (pdfParseError) {
        console.log('⚠️ pdf-parse failed, falling back to pdf2json:', pdfParseError.message);
        
        // Fallback to pdf2json
        text = await this.parseWithPdf2json(pdfBuffer);
      }
      
      // Image-based PDFs (scanned/screenshot) return no real words — only
      // structural artefacts like "-- 1 of 5 --". Use word-count to detect this.
      if (!text || this.countMeaningfulWords(text) < 20) {
        console.warn('⚠️ PDF has minimal text — attempting OCR on page images...');
        text = await this.extractTextWithOCR(pdfBuffer);
      }

      if (!text || this.countMeaningfulWords(text) < 20) {
        console.warn('⚠️ OCR returned minimal content. Storing for manual review.');
        return {
          ...this.defaultData(),
          needs_manual_review: true,
          summary: 'PDF stored – could not auto-parse (image-based/scanned PDF). Please review the report manually.',
          notes: 'Auto-parsing failed: no extractable text found. The PDF may be a scanned image. Uploaded file is stored for manual review.'
        };
      }

      // Parse the extracted data
      const parsedData = this.extractCarfaxData(text);
      
      console.log('✅ CARFAX PDF parsed successfully');
      return parsedData;
      
    } catch (error) {
      console.error('❌ Error parsing CARFAX PDF:', error);
      throw new Error(`Failed to parse CARFAX PDF: ${error.message}`);
    }
  }
  
  /**
   * Parse PDF using pdf2json (fallback method)
   * @param {Buffer} pdfBuffer - PDF file buffer
   * @returns {string} Extracted text
   */
  async parseWithPdf2json(pdfBuffer) {
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser();
      
      pdfParser.on('pdfParser_dataError', (errData) => {
        console.error('❌ PDF parsing error:', errData.parserError);
        reject(new Error(`PDF parsing failed: ${errData.parserError}`));
      });
      
      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        try {
          console.log('📄 PDF parsed successfully with pdf2json');
          
          // Extract text from all pages
          let text = '';
          if (pdfData.Pages) {
            pdfData.Pages.forEach(page => {
              if (page.Texts) {
                page.Texts.forEach(textItem => {
                  if (textItem.R) {
                    textItem.R.forEach(r => {
                      if (r.T) {
                        text += decodeURIComponent(r.T) + ' ';
                      }
                    });
                  }
                });
              }
            });
          }
          
          console.log(`📄 pdf2json extracted ${text.length} characters from ${pdfData.Pages?.length || 0} pages`);
          resolve(text);
        } catch (error) {
          console.error('❌ Error processing parsed PDF data:', error);
          reject(new Error(`Failed to process PDF data: ${error.message}`));
        }
      });
      
      // Parse the PDF buffer
      pdfParser.parseBuffer(pdfBuffer);
    });
  }

  /**
   * Count words that are real content (ignore page markers, dashes, URLs)
   * @param {string} text
   * @returns {number}
   */
  countMeaningfulWords(text) {
    // Strip URLs, page markers like "-- 1 of 5 --", lone dashes, and numbers-only tokens
    const cleaned = text
      .replace(/https?:\/\/\S+/g, '')
      .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '')
      .replace(/^\s*-+\s*$/gm, '');
    const words = cleaned.match(/[a-zA-Z]{3,}/g) || [];
    return words.length;
  }

  /**
   * OCR fallback — renders each PDF page to PNG then runs Tesseract
   * @param {Buffer} pdfBuffer
   * @returns {Promise<string>}
   */
  async extractTextWithOCR(pdfBuffer) {
    try {
      console.log('🔎 Starting OCR on PDF pages...');

      const pages = await pdfToPng(pdfBuffer, {
        disableFontFace: true,
        useSystemFonts: true,
        viewportScale: 2.0,
      });

      console.log(`📄 Rendered ${pages.length} page(s) for OCR`);

      let fullText = '';
      for (let i = 0; i < pages.length; i++) {
        console.log(`🔎 OCR page ${i + 1}/${pages.length}...`);
        const { data: { text } } = await Tesseract.recognize(pages[i].content, 'eng', {
          logger: () => {},
        });
        fullText += text + '\n';
      }

      console.log(`📄 OCR extracted ${fullText.length} characters`);
      console.log('📄 OCR first 500 chars:', fullText.substring(0, 500));
      return fullText;
    } catch (err) {
      console.error('❌ OCR extraction failed:', err.message);
      return '';
    }
  }

  /**
   * Extract key data from CARFAX text
   * @param {string} text - Extracted PDF text
   * @returns {Object} Structured CARFAX data
   */
  extractCarfaxData(text) {
    const data = {
      accident_count: 0,
      service_records: 0,
      owners: 0,
      title_issues: false,
      odometer_rollback: false,
      structural_damage: false,
      airbag_deployment: false,
      flood_damage: false,
      lemon_title: false,
      manufacturer_recall: false,
      previous_rental: false,
      previous_taxi: false,
      previous_police: false,
      previous_fleet: false,
      previous_lease: false,
      previous_corporate: false,
      previous_government: false,
      previous_auction: false,
      previous_repo: false,
      previous_salvage: false,
      previous_fire: false,
      previous_hail: false,
      previous_theft: false,
      previous_vandalism: false,
      previous_water: false,
      previous_other: false,
      // Additional vehicle attributes
      certified_pre_owned: false,
      personal_vehicle: false,
      commercial_vehicle: false,
      needs_manual_review: false,
      summary: '',
      notes: ''
    };

    console.log('🔍 Extracting CARFAX data from text...');
    console.log('📄 Text length:', text.length);
    console.log('📄 First 500 characters:', text.substring(0, 500));
    
    // Extract accident count
    // First check explicit "no accidents" statements so we don't count from those lines
    const noAccidentPhrases = [
      /no accidents? or damage reported/i,
      /no accidents? reported/i,
      /0 accidents?/i,
    ];
    const hasNoAccident = noAccidentPhrases.some(p => p.test(text));

    if (!hasNoAccident) {
      // Only run numeric extraction if no "no accident" phrase found
      const accidentPatterns = [
        // digit immediately beside the keyword on the same line
        /^.*?(\d+)\s+accident/im,
        /^.*?(\d+)\s+crash/im,
        /^.*?(\d+)\s+collision/im,
        /^.*?total\s+(?:loss|accident).*?(\d+)/im,
        /(\d+)\s+reported\s+accident/i,
      ];
      for (const pattern of accidentPatterns) {
        const match = text.match(pattern);
        if (match) {
          const n = parseInt(match[1]);
          // Sanity-check: reject suspiciously large numbers (year, mileage, etc.)
          if (n >= 0 && n <= 50) {
            data.accident_count = n;
            console.log('🚗 Found accident count:', data.accident_count);
            break;
          }
        }
      }
    } else {
      console.log('🚗 "No accidents" phrase detected — accident_count stays 0');
    }
    
    // Extract service records count - multiple patterns
    const servicePatterns = [
      // Most specific first: "9 Service history records" / "9 service records"
      /(\d+)\s+service\s+history\s+records?/i,
      /(\d+)\s+service\s+records?/i,
      /(\d+)\s+maintenance\s+records?/i,
      /(\d+)\s+maintenance\s+history/i,
      /service\s+history\s+records?\W+(\d+)/i,
      /total\s+service\s+records?\D+(\d+)/i,
      // CARFAX "X Detailed Records Available" format (common in newer CARFAX layouts / OCR)
      /(\d+)\s+detailed\s+records?\s+available/i,
      /(\d+)\s+detailed\s+records?/i,
    ];

    for (const pattern of servicePatterns) {
      const match = text.match(pattern);
      if (match) {
        const n = parseInt(match[1]);
        if (n >= 0 && n <= 500) {
          data.service_records = n;
          console.log('🔧 Found service records:', data.service_records);
          break;
        }
      }
    }

    // Extract number of owners — require the number to be adjacent to "owner" keyword
    // and reject values that look like years (>= 1900) or large mileage numbers (> 50)
    const ownerPatterns = [
      /carfax\s+(\d+)-owner\s+vehicle/i,
      /(\d+)-owner\s+vehicle/i,
      /(\d+)\s+owner\s+vehicle/i,
      /(\d+)\s+previous\s+owners?/i,
      /number\s+of\s+owners?\D+(\d+)/i,
      /owners?\s+estimated\D+(\d+)/i,
      /total\s+owners?\D+(\d+)/i,
    ];

    for (const pattern of ownerPatterns) {
      const match = text.match(pattern);
      if (match) {
        const n = parseInt(match[1]);
        if (n >= 1 && n <= 50) {
          data.owners = n;
          console.log('👥 Found owners:', data.owners);
          break;
        }
      }
    }
    
    // Check for title issues
    data.title_issues = this.checkForFlags(text, [
      'title problem', 'title issue', 'branded title', 'salvage title',
      'rebuilt title', 'flood title', 'lemon title', 'junk title',
      'title branded', 'title branded', 'not actual mileage',
      'title problems', 'title issues'
    ]);
    if (data.title_issues) console.log('⚠️ Title issues detected');
    
    // Check for odometer rollback - be more specific to avoid false positives
    data.odometer_rollback = this.checkForFlags(text, [
      'odometer rollback', 'mileage rollback', 'odometer discrepancy',
      'mileage discrepancy', 'odometer tampering', 'not actual mileage',
      'mileage inconsistency', 'odometer inconsistency'
    ]);
    if (data.odometer_rollback) console.log('⚠️ Odometer rollback detected');
    
    // Check for structural damage
    data.structural_damage = this.checkForFlags(text, [
      'structural damage', 'frame damage', 'unibody damage',
      'structural repair', 'frame repair', 'structural problems',
      'frame problems', 'unibody problems', 'structural issues'
    ]);
    if (data.structural_damage) console.log('⚠️ Structural damage detected');
    
    // Check for airbag deployment
    data.airbag_deployment = this.checkForFlags(text, [
      'airbag deployed', 'airbag deployment', 'airbag replaced',
      'airbag repair', 'srs deployed', 'airbag system',
      'airbag light', 'airbag warning', 'airbag malfunction'
    ]);
    if (data.airbag_deployment) console.log('⚠️ Airbag deployment detected');
    
    // Check for flood damage
    data.flood_damage = this.checkForFlags(text, [
      'flood damage', 'water damage', 'hurricane damage',
      'storm damage', 'flooded', 'water intrusion',
      'flood title', 'water damage title', 'hurricane title',
      'storm title', 'flooded vehicle', 'water damaged'
    ]);
    if (data.flood_damage) console.log('⚠️ Flood damage detected');
    
    // Check for lemon title
    data.lemon_title = this.checkForFlags(text, [
      'lemon title', 'lemon law', 'manufacturer buyback',
      'lemon buyback', 'lemon law buyback', 'lemon law title',
      'manufacturer repurchase', 'lemon law repurchase'
    ]);
    if (data.lemon_title) console.log('⚠️ Lemon title detected');
    
    // Check for manufacturer recall
    data.manufacturer_recall = this.checkForFlags(text, [
      'manufacturer recall', 'safety recall', 'recall campaign',
      'recall notice', 'voluntary recall', 'recall',
      'manufacturer recall notice', 'safety recall notice'
    ]);
    if (data.manufacturer_recall) console.log('⚠️ Manufacturer recall detected');
    
    // Check for previous usage types
    data.previous_rental = this.checkForFlags(text, [
      'rental vehicle', 'rental car', 'rental fleet', 'rental use',
      'rental', 'rental company', 'rental agency', 'rental business'
    ]);
    if (data.previous_rental) console.log('🚗 Previous rental use detected');
    
    data.previous_taxi = this.checkForFlags(text, [
      'taxi', 'taxi service', 'taxi use', 'taxi cab', 
      'taxi company', 'taxi business', 'taxi fleet',
      'livery service', 'livery vehicle', 'livery use'
    ]);
    if (data.previous_taxi) console.log('🚕 Previous taxi use detected');
    
    data.previous_police = this.checkForFlags(text, [
      'police', 'police vehicle', 'police use', 'law enforcement',
      'police fleet', 'sheriff', 'patrol vehicle', 'police department',
      'law enforcement vehicle', 'police car'
    ]);
    if (data.previous_police) console.log('🚔 Previous police use detected');
    
    data.previous_fleet = this.checkForFlags(text, [
      'fleet vehicle', 'fleet use', 'commercial fleet', 'company fleet',
      'fleet', 'fleet management', 'fleet service'
    ]);
    if (data.previous_fleet) console.log('🚛 Previous fleet use detected');
    
    data.previous_lease = this.checkForFlags(text, [
      'lease vehicle', 'leased', 'lease return', 'lease use',
      'lease', 'leasing', 'lease company', 'lease business'
    ]);
    if (data.previous_lease) console.log('📋 Previous lease use detected');
    
    data.previous_corporate = this.checkForFlags(text, [
      'corporate', 'corporate vehicle', 'business use', 'corporate fleet',
      'corporate car', 'business vehicle', 'company car'
    ]);
    if (data.previous_corporate) console.log('🏢 Previous corporate use detected');
    
    data.previous_government = this.checkForFlags(text, [
      'government', 'government vehicle', 'municipal', 'city vehicle',
      'state vehicle', 'federal vehicle', 'government fleet',
      'municipal vehicle', 'city car', 'state car'
    ]);
    if (data.previous_government) console.log('🏛️ Previous government use detected');
    
    data.previous_auction = this.checkForFlags(text, [
      'auction', 'auction vehicle', 'auction sale', 'auto auction',
      'auction house', 'auction lot', 'auctioned'
    ]);
    if (data.previous_auction) console.log('🔨 Previous auction use detected');
    
    data.previous_repo = this.checkForFlags(text, [
      'repossessed', 'repo', 'repossession', 'repossessed vehicle',
      'repossession sale', 'repo sale'
    ]);
    if (data.previous_repo) console.log('🔒 Previous repossession detected');
    
    data.previous_salvage = this.checkForFlags(text, [
      'salvage', 'salvage vehicle', 'salvage title', 'total loss',
      'insurance total loss', 'salvage yard', 'salvage auction'
    ]);
    if (data.previous_salvage) console.log('💥 Previous salvage detected');
    
    data.previous_fire = this.checkForFlags(text, [
      'fire damage', 'fire', 'burned', 'fire incident',
      'fire damage title', 'fire damaged', 'fire loss'
    ]);
    if (data.previous_fire) console.log('🔥 Previous fire damage detected');
    
    data.previous_hail = this.checkForFlags(text, [
      'hail damage', 'hail', 'hail storm', 'hail damage repair',
      'hail damage title', 'hail damaged'
    ]);
    if (data.previous_hail) console.log('❄️ Previous hail damage detected');
    
    data.previous_theft = this.checkForFlags(text, [
      'theft', 'stolen', 'theft recovery', 'stolen vehicle',
      'theft recovery title', 'stolen vehicle recovery'
    ]);
    if (data.previous_theft) console.log('🔓 Previous theft detected');
    
    data.previous_vandalism = this.checkForFlags(text, [
      'vandalism', 'vandalized', 'vandalism damage',
      'vandalism title', 'vandalized vehicle'
    ]);
    if (data.previous_vandalism) console.log('💢 Previous vandalism detected');
    
    data.previous_water = this.checkForFlags(text, [
      'water damage', 'water intrusion', 'water leak',
      'water damage title', 'water damaged'
    ]);
    if (data.previous_water) console.log('💧 Previous water damage detected');
    
    // Check for certified pre-owned status
    data.certified_pre_owned = this.checkForFlags(text, [
      'certified pre-owned', 'certified pre owned', 'cpo', 'certified used',
      'manufacturer certified', 'factory certified', 'certified vehicle', 'Hyundai Certified Pre-Owned'
    ]);
    if (data.certified_pre_owned) console.log('⭐ Certified pre-owned detected');
    
    // Check for personal vehicle use
    // Use checkForFlags for generic phrases, but also do a direct targeted search
    // for CARFAX-specific ownership section phrases that are unambiguously positive
    const personalPhrases = [
      /type\s+of\s+owner\s+personal/i,
      /owner\s*\d*\s+personal\s+vehicle/i,
      /titled\s+or\s+registered\s+as\s+personal\s+vehicle/i,
      /personal\s+ownership/i,
    ];
    data.personal_vehicle = personalPhrases.some(p => p.test(text))
      || this.checkForFlags(text, [
        'personal vehicle', 'personal use', 'private vehicle', 'private use',
      ]);
    if (data.personal_vehicle) console.log('🏠 Personal vehicle detected');
    
    // Check for commercial vehicle use
    data.commercial_vehicle = this.checkForFlags(text, [
      'commercial vehicle', 'commercial use', 'business vehicle', 'business use',
      'commercial registration', 'commercial title', 'commercial fleet'
    ]);
    if (data.commercial_vehicle) console.log('🏢 Commercial vehicle detected');
    
    // Generate summary
    data.summary = this.generateSummary(data);
    console.log('📝 Generated summary:', data.summary);
    
    // Add notes
    data.notes = this.extractNotes(text);
    console.log('📋 Extracted notes:', data.notes);
    
    console.log('✅ CARFAX data extraction completed');
    console.log('📊 Final data:', {
      accident_count: data.accident_count,
      service_records: data.service_records,
      owners: data.owners,
      issues_found: Object.keys(data).filter(key => 
        typeof data[key] === 'boolean' && data[key] === true
      ).length
    });
    
    return data;
  }

  /**
   * Return a zeroed-out default data object (used for manual-review fallback)
   */
  defaultData() {
    return {
      accident_count: 0,
      service_records: 0,
      owners: 0,
      title_issues: false,
      odometer_rollback: false,
      structural_damage: false,
      airbag_deployment: false,
      flood_damage: false,
      lemon_title: false,
      manufacturer_recall: false,
      previous_rental: false,
      previous_taxi: false,
      previous_police: false,
      previous_fleet: false,
      previous_lease: false,
      previous_corporate: false,
      previous_government: false,
      previous_auction: false,
      previous_repo: false,
      previous_salvage: false,
      previous_fire: false,
      previous_hail: false,
      previous_theft: false,
      previous_vandalism: false,
      previous_water: false,
      previous_other: false,
      certified_pre_owned: false,
      personal_vehicle: false,
      commercial_vehicle: false,
      needs_manual_review: false,
      summary: '',
      notes: ''
    };
  }

  /**
   * Check if any of the flags exist in the text with proper context
   * @param {string} text - Text to search
   * @param {string[]} flags - Array of flags to check
   * @returns {boolean} True if any flag is found in positive context
   */
  checkForFlags(text, flags) {
    const lowerText = text.toLowerCase();
    
    // Negative indicators that would negate the flag
    const negativeIndicators = [
      'no ', 'none', 'not ', 'never', 'clean', 'clear', 'no record of',
      'no evidence of', 'no indication of', 'no sign of', 'no report of',
      'no history of', 'no previous', 'no known', 'no reported',
      'free of', 'without', 'absent', 'negative', 'false', 'guaranteed',
      'no issues', 'no problem', 'no indication', 'no evidence',
    ];
    
    // Context patterns that indicate false positives
    const falsePositivePatterns = [
      'customer favorites', 'glossary', 'help center', 'report provided',
      'damage brands', 'guaranteed no problem', 'no issues reported',
      'no indication of', 'no evidence of', 'no sign of', 'no issues indicated',
      'vehicle serviced', 'pre-delivery inspection', 'emissions or safety inspection',
      // CARFAX boilerplate disclaimer phrases
      'these title problems', 'none of these title', 'if you find that any',
      'reported by a dmv', 'reported by a u.s. state', 'you may qualify',
      'carfax guarantees the information',
      // Routine DMV/registry events — not title problems
      'title issued or updated', 'title issued',
      // Odometer brands guarantee section
      'odometer brands', 'exceeds mechanical limits'
    ];
    
    for (const flag of flags) {
      const flagLower = flag.toLowerCase();
      const flagIndex = lowerText.indexOf(flagLower);
      
      if (flagIndex !== -1) {
        // Check the context around the flag
        const contextStart = Math.max(0, flagIndex - 100);
        const contextEnd = Math.min(lowerText.length, flagIndex + flagLower.length + 100);
        const context = lowerText.substring(contextStart, contextEnd);
        
        // Check for false positive patterns
        const hasFalsePositiveContext = falsePositivePatterns.some(pattern => 
          context.includes(pattern)
        );
        
        if (hasFalsePositiveContext) {
          console.log(`❌ Found false positive context for flag: "${flag}" in context: "${context.trim()}"`);
          continue;
        }
        
        // Check if any negative indicators appear before the flag in the context
        const hasNegativeContext = negativeIndicators.some(negative => {
          const negativeIndex = context.indexOf(negative);
          return negativeIndex !== -1 && negativeIndex < (flagIndex - contextStart);
        });
        
        if (!hasNegativeContext) {
          console.log(`✅ Found positive flag: "${flag}" in context: "${context.trim()}"`);
          return true;
        } else {
          console.log(`❌ Found negative context for flag: "${flag}" in context: "${context.trim()}"`);
        }
      }
    }
    
    return false;
  }
  
  /**
   * Generate a summary based on parsed data
   * @param {Object} data - Parsed CARFAX data
   * @returns {string} Summary text
   */
  generateSummary(data) {
    const issues = [];
    
    if (data.accident_count > 0) {
      issues.push(`${data.accident_count} accident${data.accident_count > 1 ? 's' : ''}`);
    }
    
    if (data.title_issues) {
      issues.push('title issues');
    }
    
    if (data.structural_damage) {
      issues.push('structural damage');
    }
    
    if (data.flood_damage) {
      issues.push('flood damage');
    }
    
    if (data.airbag_deployment) {
      issues.push('airbag deployment');
    }
    
    if (data.lemon_title) {
      issues.push('lemon title');
    }
    
    if (data.odometer_rollback) {
      issues.push('odometer rollback');
    }
    
    const previousUses = [];
    if (data.previous_rental) previousUses.push('rental');
    if (data.previous_taxi) previousUses.push('taxi');
    if (data.previous_police) previousUses.push('police');
    if (data.previous_fleet) previousUses.push('fleet');
    if (data.previous_lease) previousUses.push('lease');
    if (data.previous_corporate) previousUses.push('corporate');
    if (data.previous_government) previousUses.push('government');
    if (data.previous_auction) previousUses.push('auction');
    if (data.previous_repo) previousUses.push('repossessed');
    if (data.previous_salvage) previousUses.push('salvage');
    
    if (previousUses.length > 0) {
      issues.push(`previous ${previousUses.join(', ')} use`);
    }
    
    if (issues.length === 0) {
      return `Clean history - ${data.service_records} service records, ${data.owners} owner${data.owners > 1 ? 's' : ''}`;
    }
    
    return `Issues found: ${issues.join(', ')}. ${data.service_records} service records, ${data.owners} owner${data.owners > 1 ? 's' : ''}`;
  }
  
  /**
   * Extract additional notes from the text
   * @param {string} text - PDF text
   * @returns {string} Notes
   */
  extractNotes(text) {
    // Look for specific sections or patterns
    const notes = [];
    
    // Extract VIN if found
    const vinMatch = text.match(/VIN[:\s]*([A-HJ-NPR-Z0-9]{17})/i);
    if (vinMatch) {
      notes.push(`VIN: ${vinMatch[1]}`);
    }
    
    // Extract report date if found
    const datePatterns = [
      /report\s+date[:\s]*([0-9\/\-]+)/i,
      /generated\s+on[:\s]*([0-9\/\-]+)/i,
      /date[:\s]*([0-9\/\-]+)/i,
      /(\d{1,2}\/\d{1,2}\/\d{4})/,
      /(\d{4}-\d{2}-\d{2})/
    ];
    
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        notes.push(`Report Date: ${match[1]}`);
        break;
      }
    }
    
    // Extract vehicle information
    const vehiclePatterns = [
      /(\d{4})\s+([A-Za-z]+)\s+([A-Za-z\s]+)/i,
      /([A-Za-z]+)\s+([A-Za-z\s]+)\s+(\d{4})/i
    ];
    
    for (const pattern of vehiclePatterns) {
      const match = text.match(pattern);
      if (match) {
        notes.push(`Vehicle: ${match[0]}`);
        break;
      }
    }
    
    // Extract mileage information
    const mileagePatterns = [
      /(\d{1,3}(?:,\d{3})*)\s*miles/i,
      /mileage[:\s]*(\d{1,3}(?:,\d{3})*)/i,
      /(\d{1,3}(?:,\d{3})*)\s*mile/i
    ];
    
    for (const pattern of mileagePatterns) {
      const match = text.match(pattern);
      if (match) {
        notes.push(`Mileage: ${match[1]} miles`);
        break;
      }
    }
    
    // Extract any additional important information
    const importantPatterns = [
      /clean\s+title/i,
      /no\s+accidents/i,
      /one\s+owner/i,
      /multiple\s+owners/i,
      /service\s+records/i,
      /maintenance\s+records/i
    ];
    
    for (const pattern of importantPatterns) {
      const match = text.match(pattern);
      if (match) {
        notes.push(`Note: ${match[0]}`);
      }
    }
    
    return notes.join('; ');
  }
}

export default new CarfaxParserService();
