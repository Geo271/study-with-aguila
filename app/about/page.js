import Link from 'next/link'

const features = [
  { title: 'AI-Powered Q&A', desc: 'Ask anything about your uploaded notes and get precise, structured answers from Aguila.' },
  { title: 'Auto Quiz Generation', desc: 'Upload a PDF and a quiz is automatically generated — no prompting required.' },
  { title: 'Quiz Archive', desc: 'All your quizzes are saved. Browse, retake, or delete them anytime.' },
  { title: 'Study Sessions', desc: 'Group multiple PDFs into one session so Aguila can answer across all your notes.' },
  { title: 'Focus Timer', desc: 'Built-in Pomodoro timer with customizable focus and break intervals.' },
  { title: 'Task Manager', desc: 'Add tasks with deadlines and get browser notifications before they are due.' },
  { title: 'Progress Dashboard', desc: 'Track quiz scores, focus accuracy, and study activity over time.' },
  { title: 'Grammar and Writing Help', desc: 'Aguila can also check grammar, improve your writing, and help with assignments.' },
]

export default function About() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-neutral-950/90 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 48 52" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
            <polygon points="14,14 16,6 19,13" fill="#4A2F0A"/>
            <polygon points="18,12 21,4 24,11" fill="#5C3D11"/>
            <polygon points="22,11 25,3 28,10" fill="#4A2F0A"/>
            <ellipse cx="24" cy="23" rx="13" ry="12" fill="#8B5E2A"/>
            <ellipse cx="25" cy="25" rx="8.5" ry="7.5" fill="#F2DEB0"/>
            <polygon points="33,22 42,25 33,28" fill="#F5C218"/>
            <circle cx="29" cy="22" r="3" fill="#1A0800"/>
            <circle cx="30" cy="21" r="0.8" fill="#fff"/>
            <ellipse cx="24" cy="42" rx="13" ry="11" fill="#8B5E2A"/>
            <path d="M11 38 Q2 44 4 52 Q12 46 19 44" fill="#5C3D11"/>
            <path d="M37 38 Q46 44 44 52 Q36 46 29 44" fill="#5C3D11"/>
          </svg>
          <span className="font-bold text-white">Study with Aguila</span>
        </div>
        <Link href="/" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
          Open app
        </Link>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-14 space-y-16">
        {/* Hero */}
        <section className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Your personal<br/>
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              AI study companion
            </span>
          </h1>
          <p className="text-neutral-400 text-lg max-w-xl mx-auto leading-relaxed">
            Study with Aguila turns your PDF notes into an interactive study experience —
            complete with quizzes, focused Q&A, a Pomodoro timer, and a task manager.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <Link href="/login"
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all text-sm">
              Sign in
            </Link>
            <Link href="/signup"
              className="px-6 py-3 bg-neutral-800 text-neutral-300 rounded-xl font-semibold hover:bg-neutral-700 border border-neutral-700 transition-all text-sm">
              Create account
            </Link>
          </div>
        </section>

        {/* Meet Agui */}
        <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-28 h-28 flex-shrink-0">
            <svg viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">
              <polygon points="22,20 25,8 29,18" fill="#4A2F0A"/>
              <polygon points="27,17 31,5 35,15" fill="#4A2F0A"/>
              <polygon points="33,15 37,4 41,14" fill="#5C3D11"/>
              <ellipse cx="36" cy="30" rx="16" ry="15" fill="#8B5E2A"/>
              <ellipse cx="37" cy="32" rx="10" ry="9" fill="#F2DEB0"/>
              <polygon points="47,28 59,31 47,34" fill="#F5C218"/>
              <circle cx="43" cy="28" r="3.5" fill="#1A0800"/>
              <circle cx="44.2" cy="26.8" r="1" fill="#fff"/>
              <ellipse cx="38" cy="66" rx="19" ry="22" fill="#8B5E2A"/>
              <ellipse cx="38" cy="72" rx="11" ry="15" fill="#F2DEB0"/>
              <path d="M19 58 Q2 70 6 90 Q18 76 29 72" fill="#5C3D11"/>
              <path d="M57 56 Q70 46 70 38 Q67 31 61 34 Q59 28 54 30 Q55 46 57 56" fill="#8B5E2A"/>
              <circle cx="65" cy="36" r="5.5" fill="#C4904A"/>
              <path d="M60 30 Q62 23 66 25 Q68 29 66 33" fill="#C4904A"/>
              <path d="M28 86 Q38 96 50 86 Q44 83 38 88 Q32 83 28 86" fill="#5C3D11"/>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Meet Agui</h2>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Agui is a Philippine Eagle — the national bird of the Philippines and one of the most powerful raptors in the world.
              As your mascot and study companion, Agui reacts to your progress, celebrates your achievements,
              and keeps you motivated with study tips and fun facts while you work.
            </p>
            <p className="text-neutral-600 text-xs mt-3 italic">
              The Philippine Eagle (Pithecophaga jefferyi) is critically endangered. Agui honors this remarkable bird.
            </p>
          </div>
        </section>

        {/* Features */}
        <section>
          <h2 className="text-xl font-bold text-white mb-6">What Aguila can do</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {features.map((f, i) => (
              <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-1.5">{f.title}</h3>
                <p className="text-xs text-neutral-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Beta notice */}
        <section className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-amber-400 mb-2">Beta Notice</h3>
          <p className="text-xs text-amber-300/70 leading-relaxed">
            Study with Aguila is currently in closed beta. Access is limited to invited testers.
            Features may change, and occasional bugs are expected. Your feedback directly shapes the product.
            Thank you for testing.
          </p>
        </section>

        <footer className="text-center text-xs text-neutral-700 pb-4">
          <p>Study with Aguila — Beta v1.0</p>
          <div className="flex justify-center gap-4 mt-2">
            <Link href="/eula" className="hover:text-neutral-500 transition-colors">Terms of Use</Link>
            <Link href="/login" className="hover:text-neutral-500 transition-colors">Sign in</Link>
          </div>
        </footer>
      </div>
    </main>
  )
}