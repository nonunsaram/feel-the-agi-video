"""mlx-whisper word timestamps (language ko) on the vocal stem -> work/whisper_<tag>.json (cross-check)."""
import common, json, sys
import soundfile as sf
import mlx_whisper
y, sr = common.load_stem("vocals", sr=16000)
sf.write(common.WORK / "vocals16k.wav", y, 16000)
PROMPT = "Feel The AGI. 사랑을 속삭이네 반짝이는 너와의 미래 느껴봐 새 시대. AGI, ChatGPT Claude or Gemini, 다왔다 말해줘 tell me now. 나도 이제 밑에 agent 시켜서 태업 아님 폐업."
for tag, model, prompt in [("large", "mlx-community/whisper-large-v3-mlx", None), ("large_prompt", "mlx-community/whisper-large-v3-mlx", PROMPT)]:
    res = mlx_whisper.transcribe(str(common.WORK / "vocals16k.wav"), path_or_hf_repo=model, language="ko",
        word_timestamps=True, condition_on_previous_text=False, initial_prompt=prompt, temperature=0.0,
        no_speech_threshold=None, hallucination_silence_threshold=None)
    (common.WORK / f"whisper_{tag}.json").write_text(json.dumps(res, indent=1, default=float, ensure_ascii=False))
    print("==", tag)
    for seg in res["segments"]:
        print(f"{seg['start']:7.2f} {seg['end']:7.2f} {seg['text']}")
        print("   ", " ".join(f"{w['word'].strip()}@{w['start']:.2f}" for w in seg.get("words", [])))
