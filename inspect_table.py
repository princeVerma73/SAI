import fitz

doc = fitz.open(r'C:\Users\rishu\Downloads\Sai report final v2.pdf')
page = doc[0]
blocks = page.get_text('dict')['blocks']
for b in blocks:
    if 'lines' in b:
        for l in b['lines']:
            for s in l['spans']:
                if 340 <= s['bbox'][1] <= 510:
                    bbox = [round(x, 2) for x in s['bbox']]
                    print(f"bbox={bbox}, font={s['font']}, sz={s['size']:.2f}, text={repr(s['text'])}")
