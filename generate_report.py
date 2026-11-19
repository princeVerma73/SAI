import fitz
import os

pdf_in = r"C:\Users\rishu\Downloads\Sai report final v2.pdf"
pdf_out = r"C:\Users\rishu\Downloads\Sai_Internship_Report_Updated.pdf"

doc = fitz.open(pdf_in)
page = doc[0]

# Redact the table body rows (y from 365.8 to 505.5, x from 92.5 to 518.5)
# Using graphics=0 to preserve the table grid lines
rect = fitz.Rect(92.5, 365.8, 518.5, 505.5)
page.add_redact_annot(rect, fill=(1, 1, 1))
page.apply_redactions(graphics=0)

# Fonts
font_reg_path = r"C:\Windows\Fonts\trebuc.ttf"
font_bold_path = r"C:\Windows\Fonts\trebucbd.ttf"

page.insert_font(fontname="TrebReg", fontfile=font_reg_path)
page.insert_font(fontname="TrebBold", fontfile=font_bold_path)

f_reg = fitz.Font(fontfile=font_reg_path)
f_bold = fitz.Font(fontfile=font_bold_path)

# The 6 members
members = [
    ("Sourabh Kumar", "CSE", "240101232"),
    ("Prince Kumar", "CSE", "240101182"),
    ("Utsav Kumar", "CSE", "2401011"),
    ("Jaswanth Sai", "CSE", "240101212"),
    ("Harshith Kumar", "CSE", "240101178"),
    ("Tharun Teja", "CSE", "240101183"),
]

# Row baselines in original PDF:
# Row 0: y=383.0
# Row 1: y=406.5
# Row 2: y=430.0
# Row 3: y=453.5
# Row 4: y=477.0
# Row 5: y=500.5
row_baselines = [383.0, 406.5, 430.0, 453.5, 477.0, 500.5]

font_size_name = 17.5
font_size_branch = 18.5
font_size_roll = 18.0

for i, (name, branch, roll) in enumerate(members):
    base_y = row_baselines[i]
    
    # 1. Name (Left aligned at x=97.32)
    name_len = f_reg.text_length(name, fontsize=font_size_name)
    cur_name_size = font_size_name
    max_name_w = 266.64 - 97.32 - 6
    if name_len > max_name_w:
        cur_name_size = font_size_name * (max_name_w / name_len)
    page.insert_text(fitz.Point(97.32, base_y), name, fontname="TrebReg", fontsize=cur_name_size, color=(0, 0, 0))
    
    # 2. Branch (Centered between 266.64 and 376.80)
    branch_len = f_reg.text_length(branch, fontsize=font_size_branch)
    branch_x = 266.64 + (376.80 - 266.64 - branch_len) / 2
    page.insert_text(fitz.Point(branch_x, base_y), branch, fontname="TrebReg", fontsize=font_size_branch, color=(0, 0, 0))
    
    # 3. Roll (Centered between 376.80 and 519.24, bold)
    roll_len = f_bold.text_length(roll, fontsize=font_size_roll)
    roll_x = 376.80 + (519.24 - 376.80 - roll_len) / 2
    page.insert_text(fitz.Point(roll_x, base_y), roll, fontname="TrebBold", fontsize=font_size_roll, color=(0, 0, 0))

doc.save(pdf_out)
doc.close()
print("Successfully generated:", pdf_out)
