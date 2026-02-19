import { Zap, Clock, Award, Users } from 'lucide-react';

export default function AboutPage() {
  const features = [
    {
      title: 'Multi-Sport Support',
      description:
        'Track and manage competitions across football, basketball, cricket, tennis, and many more sports all in one platform.',
      icon: <Zap className="w-6 h-6" />,
      color: 'from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/20',
    },
    {
      title: 'Real-Time Scoring',
      description:
        'Get live score updates as they happen. Our platform delivers instant match events, goals, cards, and score changes.',
      icon: <Clock className="w-6 h-6" />,
      color: 'from-red-500/20 to-red-500/5 text-red-400 border-red-500/20',
    },
    {
      title: 'Tournament Management',
      description:
        'Create and manage tournaments with ease. Support for league, knockout, group stage, and custom formats.',
      icon: <Award className="w-6 h-6" />,
      color: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/20',
    },
    {
      title: 'Team Management',
      description:
        'Manage team rosters, player profiles, statistics, and match history. Keep everything organized in one place.',
      icon: <Users className="w-6 h-6" />,
      color: 'from-blue-500/20 to-blue-500/5 text-blue-400 border-blue-500/20',
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="relative overflow-hidden hero-mesh border-b border-white/[0.06]">
        <div className="pattern-dots absolute inset-0" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-5 text-white">
            About <span className="gradient-text">SportScore</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            The all-in-one platform for managing sports competitions and delivering live scores
          </p>
        </div>
      </section>

      {/* Description */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="space-y-5">
          <p className="text-slate-400 leading-relaxed text-lg">
            SportScore is a comprehensive sports management and live scoring platform designed
            for organizers, teams, players, and fans. Whether you are running a local league
            or managing a large-scale tournament, SportScore provides all the tools you need
            to keep everything running smoothly.
          </p>
          <p className="text-slate-400 leading-relaxed text-lg">
            Our platform supports multiple sports and competition formats, from round-robin
            leagues to single-elimination knockouts. With real-time scoring capabilities,
            every goal, point, and match event is tracked and displayed instantly to followers
            around the world.
          </p>
          <p className="text-slate-400 leading-relaxed text-lg">
            Built by sports enthusiasts for sports enthusiasts, SportScore combines powerful
            management tools with an intuitive interface that makes it easy for anyone to
            organize and follow competitive sports.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-white text-center mb-12 tracking-tight">
            Platform Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="glass-card p-7 hover:scale-[1.02] transition-all group"
              >
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-b ${feature.color} border flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-black text-white text-center mb-4 tracking-tight">
          Built with Modern Technology
        </h2>
        <p className="text-slate-400 text-center text-lg mb-10">
          SportScore leverages cutting-edge technologies to deliver a fast, reliable, and
          scalable experience.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: 'Next.js', description: 'React Framework', color: 'text-white' },
            { name: 'TypeScript', description: 'Type Safety', color: 'text-blue-400' },
            { name: 'NestJS', description: 'Backend API', color: 'text-red-400' },
            { name: 'PostgreSQL', description: 'Database', color: 'text-emerald-400' },
          ].map((tech) => (
            <div
              key={tech.name}
              className="glass-card text-center p-5 hover:scale-[1.05] transition-all"
            >
              <div className={`text-lg font-extrabold ${tech.color}`}>{tech.name}</div>
              <div className="text-sm text-slate-500 mt-1 font-medium">{tech.description}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
