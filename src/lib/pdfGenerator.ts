import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { MasterProfile, TailoredResumeData } from '@/types/profile';

export async function generateAtsResumePdf(
  profile: MasterProfile,
  tailoredData?: TailoredResumeData | null
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  // Standard US Letter: 612 x 792 pt (0.5 inch margins = 36 pt)
  let page = pdfDoc.addPage([612, 792]);
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const marginX = 40;
  const contentWidth = width - marginX * 2;
  let cursorY = height - 40;
  const bottomMargin = 40;

  const checkPageBreak = (neededHeight: number) => {
    if (cursorY - neededHeight < bottomMargin) {
      page = pdfDoc.addPage([612, 792]);
      cursorY = height - 40;
    }
  };

  const drawSectionHeading = (title: string) => {
    checkPageBreak(30);
    cursorY -= 8;
    page.drawText(title.toUpperCase(), {
      x: marginX,
      y: cursorY,
      size: 11,
      font: fontBold,
      color: rgb(0.12, 0.2, 0.35),
    });
    cursorY -= 4;
    page.drawLine({
      start: { x: marginX, y: cursorY },
      end: { x: width - marginX, y: cursorY },
      thickness: 1,
      color: rgb(0.8, 0.82, 0.85),
    });
    cursorY -= 12;
  };

  // 1. Header (Name & Contact)
  const name = profile.personalInfo.fullName;
  const nameWidth = fontBold.widthOfTextAtSize(name, 20);
  page.drawText(name, {
    x: (width - nameWidth) / 2,
    y: cursorY,
    size: 20,
    font: fontBold,
    color: rgb(0.08, 0.12, 0.2),
  });
  cursorY -= 18;

  // Headline
  const headline = tailoredData?.tailoredHeadline || profile.headline;
  const headlineSize = 9.5;
  const headlineWidth = fontRegular.widthOfTextAtSize(headline, headlineSize);
  // Center if fits, otherwise wrap
  if (headlineWidth <= contentWidth) {
    page.drawText(headline, {
      x: (width - headlineWidth) / 2,
      y: cursorY,
      size: headlineSize,
      font: fontRegular,
      color: rgb(0.25, 0.3, 0.38),
    });
  } else {
    page.drawText(headline.slice(0, 100) + '...', {
      x: marginX,
      y: cursorY,
      size: headlineSize,
      font: fontRegular,
      color: rgb(0.25, 0.3, 0.38),
    });
  }
  cursorY -= 14;

  // Contact line
  const contactParts = [
    profile.personalInfo.email,
    profile.personalInfo.phone,
    profile.personalInfo.location,
    profile.personalInfo.portfolio.replace('https://', ''),
    profile.personalInfo.github.replace('https://', ''),
    profile.personalInfo.linkedIn.replace('https://', ''),
  ].filter(Boolean);
  const contactText = contactParts.join(' | ');
  const contactWidth = fontRegular.widthOfTextAtSize(contactText, 8.5);
  page.drawText(contactText, {
    x: Math.max(marginX, (width - contactWidth) / 2),
    y: cursorY,
    size: 8.5,
    font: fontRegular,
    color: rgb(0.3, 0.35, 0.42),
  });
  cursorY -= 14;

  // 2. Summary
  drawSectionHeading('Professional Summary');
  const summaryText = tailoredData?.tailoredSummary || profile.summary;
  const wrapText = (text: string, font: typeof fontRegular, fontSize: number, maxWidth: number) => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);
      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  const summaryLines = wrapText(summaryText, fontRegular, 9, contentWidth);
  for (const line of summaryLines) {
    checkPageBreak(12);
    page.drawText(line, {
      x: marginX,
      y: cursorY,
      size: 9,
      font: fontRegular,
      color: rgb(0.18, 0.22, 0.28),
    });
    cursorY -= 12;
  }
  cursorY -= 6;

  // 3. Technical Skills
  drawSectionHeading('Technical Skills');
  for (const cat of profile.skillCategories) {
    checkPageBreak(14);
    const catLabel = `${cat.category}: `;
    const skillsList = cat.skills.join(', ');
    const labelWidth = fontBold.widthOfTextAtSize(catLabel, 9);

    page.drawText(catLabel, {
      x: marginX,
      y: cursorY,
      size: 9,
      font: fontBold,
      color: rgb(0.15, 0.2, 0.28),
    });

    const lines = wrapText(skillsList, fontRegular, 9, contentWidth - labelWidth);
    if (lines.length > 0) {
      page.drawText(lines[0], {
        x: marginX + labelWidth,
        y: cursorY,
        size: 9,
        font: fontRegular,
        color: rgb(0.2, 0.25, 0.32),
      });
      cursorY -= 12;

      for (let i = 1; i < lines.length; i++) {
        checkPageBreak(12);
        page.drawText(lines[i], {
          x: marginX + labelWidth,
          y: cursorY,
          size: 9,
          font: fontRegular,
          color: rgb(0.2, 0.25, 0.32),
        });
        cursorY -= 12;
      }
    } else {
      cursorY -= 12;
    }
  }
  cursorY -= 6;

  // 4. Experience
  drawSectionHeading('Work Experience');
  for (const exp of profile.experience) {
    checkPageBreak(40);
    // Role & Dates
    page.drawText(exp.role, {
      x: marginX,
      y: cursorY,
      size: 10,
      font: fontBold,
      color: rgb(0.1, 0.15, 0.25),
    });

    const dateRange = `${exp.startDate} - ${exp.current ? 'Present' : exp.endDate}`;
    const dateWidth = fontRegular.widthOfTextAtSize(dateRange, 9);
    page.drawText(dateRange, {
      x: width - marginX - dateWidth,
      y: cursorY,
      size: 9,
      font: fontRegular,
      color: rgb(0.35, 0.4, 0.48),
    });
    cursorY -= 12;

    // Company & Location
    page.drawText(`${exp.company} | ${exp.location}`, {
      x: marginX,
      y: cursorY,
      size: 9,
      font: fontOblique,
      color: rgb(0.25, 0.3, 0.4),
    });
    cursorY -= 12;

    // Bullets (tailored if available)
    const bullets = (tailoredData?.tailoredHighlights && tailoredData.tailoredHighlights[exp.id]) || exp.highlights;
    for (const bullet of bullets) {
      const bulletLines = wrapText(bullet, fontRegular, 8.8, contentWidth - 14);
      for (let i = 0; i < bulletLines.length; i++) {
        checkPageBreak(11);
        if (i === 0) {
          page.drawText('•', {
            x: marginX + 2,
            y: cursorY,
            size: 9,
            font: fontRegular,
            color: rgb(0.2, 0.3, 0.45),
          });
        }
        page.drawText(bulletLines[i], {
          x: marginX + 14,
          y: cursorY,
          size: 8.8,
          font: fontRegular,
          color: rgb(0.18, 0.22, 0.28),
        });
        cursorY -= 11.5;
      }
    }
    cursorY -= 4;
  }

  // 5. Featured Projects
  drawSectionHeading('Featured Projects');
  for (const proj of profile.projects) {
    checkPageBreak(35);
    page.drawText(proj.name, {
      x: marginX,
      y: cursorY,
      size: 10,
      font: fontBold,
      color: rgb(0.1, 0.15, 0.25),
    });

    const techString = proj.technologies.slice(0, 4).join(', ');
    const techWidth = fontRegular.widthOfTextAtSize(techString, 8.5);
    page.drawText(techString, {
      x: width - marginX - techWidth,
      y: cursorY,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.35, 0.4, 0.48),
    });
    cursorY -= 12;

    page.drawText(proj.subtitle, {
      x: marginX,
      y: cursorY,
      size: 8.5,
      font: fontOblique,
      color: rgb(0.25, 0.3, 0.4),
    });
    cursorY -= 11;

    const bullets = (tailoredData?.tailoredHighlights && tailoredData.tailoredHighlights[proj.id]) || proj.highlights;
    for (const bullet of bullets) {
      const bulletLines = wrapText(bullet, fontRegular, 8.8, contentWidth - 14);
      for (let i = 0; i < bulletLines.length; i++) {
        checkPageBreak(11);
        if (i === 0) {
          page.drawText('•', {
            x: marginX + 2,
            y: cursorY,
            size: 9,
            font: fontRegular,
            color: rgb(0.2, 0.3, 0.45),
          });
        }
        page.drawText(bulletLines[i], {
          x: marginX + 14,
          y: cursorY,
          size: 8.8,
          font: fontRegular,
          color: rgb(0.18, 0.22, 0.28),
        });
        cursorY -= 11.5;
      }
    }
    cursorY -= 4;
  }

  // 6. Education
  drawSectionHeading('Education');
  for (const edu of profile.education) {
    checkPageBreak(25);
    page.drawText(edu.institution, {
      x: marginX,
      y: cursorY,
      size: 9.5,
      font: fontBold,
      color: rgb(0.1, 0.15, 0.25),
    });

    const dates = `${edu.startDate} - ${edu.endDate}`;
    const dateWidth = fontRegular.widthOfTextAtSize(dates, 8.5);
    page.drawText(dates, {
      x: width - marginX - dateWidth,
      y: cursorY,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.35, 0.4, 0.48),
    });
    cursorY -= 11;

    const degreeLine = `${edu.degree} in ${edu.fieldOfStudy}${edu.grade ? ` (${edu.grade})` : ''}`;
    page.drawText(degreeLine, {
      x: marginX,
      y: cursorY,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.25, 0.3, 0.35),
    });
    cursorY -= 12;
  }

  return await pdfDoc.save();
}
