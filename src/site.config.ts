export const siteConfig = {
  title: "Hein Lin Aung",
  description: "Backend engineer and team lead. Notes on APIs, infrastructure, and the boring middle of shipping software.",
  author: "Hein Lin Aung",
  authorInitial: "H",
  role: "Backend engineer · Team lead",
  bio: "I build APIs and lead a small team at Amdon. Mostly Node + Postgres, occasionally Rails.",
  location: "Yangon, Myanmar",
  url: "https://heinlinaung.github.io",
  email: "heinlinaung@amdon.com",
  social: {
    github: "https://github.com/heinlinaung",
    linkedin: "https://www.linkedin.com/in/hein-lin-aung",
    goodreads: "https://www.goodreads.com/heinlinaung",
  },
  // Configure these after running https://giscus.app on your repo.
  // Repo must have GitHub Discussions enabled.
  giscus: {
    repo: "heinlinaung/heinlinaung.github.io",
    repoId: "", // fill in from giscus.app
    category: "Comments",
    categoryId: "", // fill in from giscus.app
    mapping: "pathname",
    strict: "0",
    reactionsEnabled: "1",
    inputPosition: "top",
    theme: "noborder_dark",
    lang: "en",
  },
  stack: [
    "Node.js",
    "TypeScript",
    "Postgres",
    "MongoDB",
    "DynamoDB",
    "Rails",
    "AWS",
    "Docker",
    "Kubernetes",
    "Stripe",
    "Firebase",
    "LTI",
  ],
};

export type SiteConfig = typeof siteConfig;
