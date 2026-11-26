"""Rebuild the printable, two-innings 24-over delivery record (ReportLab)."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/downloads/Crick-English-24-over-scoring-sheet.pdf"
NAVY = HexColor("#17263d")
GRAY = HexColor("#465468")
LINE = HexColor("#718096")
PALE = HexColor("#edf1f6")


def make_sheet(path=OUTPUT):
    path.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(path), pagesize=landscape(A4))
    c.setTitle("Crick English - 24-over ball-by-ball scoring sheet")
    c.setAuthor("Crick English")
    width, height = landscape(A4)
    left, right = 10 * mm, width - 10 * mm
    inner = right - left
    label_width = 19 * mm
    cell = (inner - label_width) / 9

    def text(x, y, value, size=8, bold=False, color=NAVY):
        c.setFillColor(color)
        c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        c.drawString(x, y, value)

    for innings in (1, 2):
        for sheet in range(4):
            first = sheet * 6 + 1
            last = first + 5
            page = (innings - 1) * 4 + sheet + 1
            text(left, height - 15 * mm, "CRICK ENGLISH", 15, True)
            text(left + 58 * mm, height - 15 * mm, "24-OVER DELIVERY RECORD", 11, True)
            c.setFont("Helvetica-Bold", 9)
            c.drawRightString(right, height - 15 * mm, f"INNINGS {innings}  /  OVERS {first:02}-{last:02}")
            text(left, height - 23 * mm,
                 "Match: __________________________   Date: ______________   Batting team: ______________________________   Bowling team: ______________________________", 8.5)
            text(left, height - 29 * mm,
                 "Record every delivery in order. Write the striker's name/initials in Batter. End an over after 6 legal balls; unused boxes stay blank.", 8, color=GRAY)

            top = height - 33 * mm
            for over in range(first, last + 1):
                block_h = 24 * mm
                header_h = 5 * mm
                batter_h = 7.5 * mm
                entry_h = 9.5 * mm
                bottom = top - header_h - batter_h - entry_h
                c.setFillColor(PALE)
                c.rect(left, top - header_h, inner, header_h, stroke=0, fill=1)
                text(left + 2 * mm, top - 3.6 * mm, f"OVER {over:02}", 8, True)
                text(left + 24 * mm, top - 3.6 * mm, "Bowler: __________________________________", 8)
                text(left + 114 * mm, top - 3.6 * mm, "Over runs: ______", 8)
                text(left + 166 * mm, top - 3.6 * mm, "Score after over: ______ / ______", 8)
                c.setStrokeColor(LINE)
                c.setLineWidth(.45)
                c.rect(left, bottom, inner, header_h + batter_h + entry_h, stroke=1, fill=0)
                c.line(left, top - header_h, right, top - header_h)
                c.line(left, top - header_h - batter_h, right, top - header_h - batter_h)
                for column in range(10):
                    x = left + label_width + column * cell
                    if x < right - 1:
                        c.line(x, bottom, x, top - header_h)
                text(left + 2 * mm, top - header_h - 4.8 * mm, "Batter", 7.7, True)
                text(left + 2 * mm, bottom + 3.5 * mm, "Entry", 7.7, True)
                for entry in range(9):
                    text(left + label_width + entry * cell + 1.2 * mm,
                         bottom + entry_h - 2.5 * mm, str(entry + 1), 5.5, color=GRAY)
                top -= block_h

            text(left, 25 * mm,
                 "Wicket / correction notes (over + entry, batter out, dismissal, incoming batter): ________________________________________________________________", 7.7)
            c.setStrokeColor(LINE)
            c.line(left, 21 * mm, right, 21 * mm)
            text(left, 16 * mm,
                 "KEY   0 = dot   |   1 / 2 / 3 / 4 / 6 = bat runs   |   wd = wide   |   nb = no-ball   |   b = bye   |   lb = leg-bye   |   W = wicket", 7.5, True)
            text(left, 11 * mm,
                 "Examples: wd+1 = 2 total; nb+4 = 5 total; 2b = 2 byes. Wides/no-balls do not count toward the 6 legal balls. More than 9 entries? Continue on reverse.", 7)
            c.setFont("Helvetica", 7)
            c.drawRightString(right, 6 * mm, f"Scorer: ____________________     Page {page} of 8  |  A4 landscape  |  Print at 100%")
            c.showPage()
    c.save()
    return path


if __name__ == "__main__":
    print(make_sheet())
