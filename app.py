"""
TilGoVoice - Real-time Ovozli Tarjimon
O'zbekcha -> Boshqa tillar
Flask, Deep Translator, gTTS
"""

import os
import uuid
import time
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from deep_translator import GoogleTranslator
from gtts import gTTS

app = Flask(__name__)
CORS(app)

# Audio papkasini yaratish
AUDIO_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'audio')
os.makedirs(AUDIO_DIR, exist_ok=True)

# Qo'llab-quvvatlanadigan tillar (uz_name = o'zbekcha nomi)
SUPPORTED_LANGUAGES = {
    "en": {"name": "English", "uz_name": "Inglizcha", "native": "English", "flag": "EN"},
    "ru": {"name": "Russian", "uz_name": "Ruscha", "native": "Ruski", "flag": "RU"},
    "tr": {"name": "Turkish", "uz_name": "Turkcha", "native": "Turkce", "flag": "TR"},
    "ar": {"name": "Arabic", "uz_name": "Arabcha", "native": "Al-Arabiyya", "flag": "AR"},
    "zh-CN": {"name": "Chinese", "uz_name": "Xitoycha", "native": "Zhongwen", "flag": "CN"},
    "ko": {"name": "Korean", "uz_name": "Koreyscha", "native": "Hangugeo", "flag": "KO"},
    "ja": {"name": "Japanese", "uz_name": "Yaponcha", "native": "Nihongo", "flag": "JA"},
    "de": {"name": "German", "uz_name": "Nemischa", "native": "Deutsch", "flag": "DE"},
    "fr": {"name": "French", "uz_name": "Fransuzcha", "native": "Francais", "flag": "FR"},
    "es": {"name": "Spanish", "uz_name": "Ispancha", "native": "Espanol", "flag": "ES"},
    "it": {"name": "Italian", "uz_name": "Italyancha", "native": "Italiano", "flag": "IT"},
    "pt": {"name": "Portuguese", "uz_name": "Portugalcha", "native": "Portugues", "flag": "PT"},
    "hi": {"name": "Hindi", "uz_name": "Hindcha", "native": "Hindi", "flag": "HI"},
    "fa": {"name": "Persian", "uz_name": "Forscha", "native": "Farsi", "flag": "FA"},
    "kk": {"name": "Kazakh", "uz_name": "Qozoqcha", "native": "Qazaqsha", "flag": "KK"},
    "ky": {"name": "Kyrgyz", "uz_name": "Qirg'izcha", "native": "Kyrgyzcha", "flag": "KY"},
    "az": {"name": "Azerbaijani", "uz_name": "Ozarbayjoncha", "native": "Azerbaycanca", "flag": "AZ"},
    "uk": {"name": "Ukrainian", "uz_name": "Ukraincha", "native": "Ukrayinska", "flag": "UK"},
    "pl": {"name": "Polish", "uz_name": "Polyakcha", "native": "Polski", "flag": "PL"},
    "nl": {"name": "Dutch", "uz_name": "Gollandcha", "native": "Nederlands", "flag": "NL"},
}

# gTTS til kodlari
GTTS_LANG_MAP = {
    "zh-CN": "zh-CN",
    "kk": "kk",
    "ky": "ky",
}


def cleanup_old_audio(max_age_seconds=300):
    """Eski audio fayllarni o'chirish."""
    now = time.time()
    for filename in os.listdir(AUDIO_DIR):
        filepath = os.path.join(AUDIO_DIR, filename)
        if os.path.isfile(filepath) and now - os.path.getmtime(filepath) > max_age_seconds:
            try:
                os.remove(filepath)
            except OSError:
                pass


@app.route('/')
def index():
    """Asosiy sahifa."""
    return render_template('index.html')


@app.route('/api/languages', methods=['GET'])
def get_languages():
    """Tillar ro'yxatini qaytarish."""
    return jsonify(SUPPORTED_LANGUAGES)


@app.route('/api/translate', methods=['POST'])
def translate():
    """O'zbekchadan boshqa tilga tarjima qilish."""
    data = request.get_json()
    text = data.get('text', '').strip()
    target_lang = data.get('target_lang', 'en')

    if not text:
        return jsonify({'error': 'Matn kiritilmagan'}), 400

    if target_lang not in SUPPORTED_LANGUAGES:
        return jsonify({'error': f'Qo\'llab-quvvatlanmaydigan til: {target_lang}'}), 400

    try:
        # O'zbekchadan tarjima qilish
        translator = GoogleTranslator(source='uz', target=target_lang)
        translated_text = translator.translate(text)

        if not translated_text:
            return jsonify({'error': 'Tarjima bo\'sh qaytdi'}), 500

        # TTS audio yaratish
        cleanup_old_audio()
        audio_filename = f"{uuid.uuid4().hex}.mp3"
        audio_path = os.path.join(AUDIO_DIR, audio_filename)

        # gTTS til kodini olish
        tts_lang = GTTS_LANG_MAP.get(target_lang, target_lang)

        try:
            tts = gTTS(text=translated_text, lang=tts_lang, slow=False)
            tts.save(audio_path)
            audio_url = f"/static/audio/{audio_filename}"
        except Exception as tts_error:
            print(f"TTS xatolik: {tts_error}")
            audio_url = None

        return jsonify({
            'original_text': text,
            'translated_text': translated_text,
            'target_lang': target_lang,
            'target_lang_name': SUPPORTED_LANGUAGES[target_lang]['name'],
            'target_lang_uz_name': SUPPORTED_LANGUAGES[target_lang]['uz_name'],
            'audio_url': audio_url
        })

    except Exception as e:
        print(f"Tarjima xatoligi: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/tts', methods=['POST'])
def text_to_speech():
    """Matnni ovozga aylantirish."""
    data = request.get_json()
    text = data.get('text', '').strip()
    lang = data.get('lang', 'en')

    if not text:
        return jsonify({'error': 'Matn kiritilmagan'}), 400

    try:
        cleanup_old_audio()
        audio_filename = f"{uuid.uuid4().hex}.mp3"
        audio_path = os.path.join(AUDIO_DIR, audio_filename)

        tts_lang = GTTS_LANG_MAP.get(lang, lang)
        tts = gTTS(text=text, lang=tts_lang, slow=False)
        tts.save(audio_path)

        return jsonify({
            'audio_url': f"/static/audio/{audio_filename}"
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("  TilGoVoice - Ovozli Tarjimon")
    print("  O'zbekcha -> Boshqa tillar")
    print("  http://localhost:5000")
    print("  Ctrl+C - to'xtatish")
    print("=" * 60 + "\n")
    app.run(debug=True, host='0.0.0.0', port=5000)
