import { useParams } from 'react-router-dom';
import CardLayout from './card-layout';
import RepoCardWithData from './repo-card-with-data';

export default function RepoCardLayout() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();

  if (!owner || !repo) {
    return (
      <CardLayout
        title="Repository Not Found"
        description="The requested repository could not be found."
        image="social-cards/home-card.png"
      >
        <div className="w-[1200px] h-[630px] bg-black flex items-center justify-center">
          <div className="text-white text-4xl">Repository Not Found</div>
        </div>
      </CardLayout>
    );
  }

  return (
    <CardLayout
      title={`${owner}/${repo} - Contributor Analysis`}
      description={`Discover and visualize GitHub contributors for ${owner}/${repo}. Track open source activity, analyze contribution patterns, and celebrate community impact.`}
      image={`social-cards/repo-${owner}-${repo}.png`}
      url={`https://contributor.info/${owner}/${repo}`}
    >
      <RepoCardWithData />
    </CardLayout>
  );
}
