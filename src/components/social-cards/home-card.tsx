import { Card } from "@/components/ui/card";

export default function HomeSocialCard() {
  return (
    <div className="w-[1200px] h-[630px] bg-gradient-to-br from-background to-muted flex items-center justify-center p-16">
      <Card className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        {/* Logo */}
        <div className="w-32 h-32 bg-primary rounded-full flex items-center justify-center mb-8 relative z-10">
          <span className="text-4xl font-bold text-primary-foreground">CI</span>
        </div>

        {/* Title */}
        <h1 className="text-6xl font-bold text-center mb-4 relative z-10">
          contributor.info
        </h1>

        {/* Tagline */}
        <p className="text-2xl text-muted-foreground text-center mb-12 relative z-10">
          Visualizing Open Source Contributions
        </p>

        {/* Stats */}
        <div className="flex gap-12 relative z-10">
          <div className="text-center">
            <div className="text-4xl font-bold text-primary">1000+</div>
            <div className="text-lg text-muted-foreground">Repositories</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-primary">50K+</div>
            <div className="text-lg text-muted-foreground">Contributors</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-primary">500K+</div>
            <div className="text-lg text-muted-foreground">Pull Requests</div>
          </div>
        </div>

        {/* URL */}
        <div className="absolute bottom-8 text-lg text-muted-foreground">
          contributor.info
        </div>
      </Card>
    </div>
  );
}