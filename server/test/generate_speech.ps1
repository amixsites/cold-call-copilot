Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$synth.SetOutputToWaveFile('server/test/test_speech.wav', $format)
$synth.Speak('Hello, this is a live transcription test.')
$synth.Dispose()
Write-Host 'Speech WAV generated successfully!'
