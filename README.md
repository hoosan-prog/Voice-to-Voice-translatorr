# TilGoVoice - O'zbekcha Ovozli Tarjimon

Real-time ovozli tarjimon ilovasi. O'zbekchadan 20+ tilga tarjima qiling.

## Texnologiyalar
- Python / Flask
- Deep Translator (Google Translate)
- gTTS (Google Text-to-Speech)
- Web Speech API

## Lokal ishga tushirish

```bash
pip install -r requirements.txt
python app.py
```

Brauzerda oching: http://localhost:5000

## Deploy (Render.com)

1. GitHub ga yuklang
2. Render.com da yangi Web Service yarating
3. GitHub reponi ulang
4. Build Command: `pip install -r requirements.txt`
5. Start Command: `gunicorn app:app`

## MIT App Inventor

Deploy qilingandan so'ng, WebViewer componentiga URL ni qo'ying.
