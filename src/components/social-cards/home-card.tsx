import { GitPullRequest, Users, TrendingUp } from '@/components/ui/icon';

export default function HomeSocialCard() {
  return (
    <div className="w-[1200px] h-[630px] bg-black flex flex-col relative overflow-hidden">

      {/* Header */}
      <div className="flex justify-between items-start p-12 relative z-10">
        {/* Logo/Brand with favicon */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-8 h-8">
              <text y=".9em" fontSize="90" textAnchor="middle" x="50">🌱</text>
            </svg>
          </div>
          <span className="text-white text-xl font-semibold">contributor.info</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 px-12 pb-20 flex flex-col justify-center relative z-10">
        {/* Main title */}
        <h1 className="text-6xl font-bold text-white mb-8">
          Open Source Insights
        </h1>

        {/* Tagline */}
        <p className="text-2xl text-gray-300 mb-16">
          Visualizing contributions across the ecosystem
        </p>

        {/* Bottom section with metrics */}
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-orange-500" />
            <div>
              <span className="text-4xl font-bold text-white">50K+</span>
              <span className="text-xl text-gray-300 ml-2">Contributors</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <GitPullRequest className="w-8 h-8 text-orange-500" />
            <div>
              <span className="text-4xl font-bold text-white">500K+</span>
              <span className="text-xl text-gray-300 ml-2">Pull Requests</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-orange-500" />
            <div>
              <span className="text-4xl font-bold text-white">1000+</span>
              <span className="text-xl text-gray-300 ml-2">Repositories</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}