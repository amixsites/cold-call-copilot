Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$synth.SetOutputToWaveFile('server/test/test_speech_2.wav', $format)
$synth.Speak('Our manufacturing downtime decreased by forty percent.')
$synth.Dispose()
Write-Host 'Speech WAV 2 generated successfully!'
