import AVFoundation

/// Đọc hướng dẫn bằng giọng tiếng Việt của iOS; chế độ âm thanh "voicePrompt" để CarPlay giảm nhạc khi đọc.
final class GiongNoi: NSObject, AVSpeechSynthesizerDelegate {
    static let chung = GiongNoi()

    private let may = AVSpeechSynthesizer()
    private let giong = AVSpeechSynthesisVoice(language: "vi-VN")

    private override init() {
        super.init()
        may.delegate = self
    }

    func noi(_ chu: String, chen: Bool, amLuong: Float, toc: Float) {
        guard !chu.isEmpty else { return }
        if chen { may.stopSpeaking(at: .immediate) }
        let phien = AVAudioSession.sharedInstance()
        try? phien.setCategory(.playback, mode: .voicePrompt, options: [.duckOthers, .interruptSpokenAudioAndMixWithOthers])
        try? phien.setActive(true)
        let cau = AVSpeechUtterance(string: chu)
        cau.voice = giong
        cau.volume = max(0, min(1, amLuong))
        cau.rate = min(AVSpeechUtteranceMaximumSpeechRate, AVSpeechUtteranceDefaultSpeechRate * max(0.5, min(2, toc)))
        may.speak(cau)
    }

    func imLang() {
        may.stopSpeaking(at: .immediate)
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) { traLaiAmThanh() }
    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) { traLaiAmThanh() }

    /// Đọc xong: trả lại âm lượng cho nhạc / ứng dụng khác.
    private func traLaiAmThanh() {
        if !may.isSpeaking {
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
    }
}
