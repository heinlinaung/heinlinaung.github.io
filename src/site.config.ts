export const siteConfig = {
  title: "Hein Lin Aung",
  description:
    "Team lead with expertise in backend engineering, DevOps, and cloud infrastructure. Notes on APIs, infrastructure, and the boring middle of shipping software.",
  author: "Hein Lin Aung",
  authorInitial: "H",
  role: "Backend Team Lead · DevOps · Cloud Infrastructure",
  bio: "Experienced team lead specializing in scalable backend systems, CI/CD, and cloud infrastructure. [ Certified - AWS SAA, CKAD, Terraform ]",
  location: "Bangkok, Thailand",
  email: "heinlinaung.dev@gmail.com",
  social: {
    github: "https://github.com/heinlinaung",
    linkedin: "https://www.linkedin.com/in/hein-lin-aung",
  },
  // Configure these after running https://giscus.app on your repo.
  // Repo must have GitHub Discussions enabled.
  giscus: {
    repo: "heinlinaung/heinlinaung.github.io",
    repoId: "R_kgDOIuUkAQ", // fill in from giscus.app
    category: "Comments",
    categoryId: "DIC_kwDOIuUkAc4C8LQV", // fill in from giscus.app
    mapping: "pathname",
    strict: "0",
    reactionsEnabled: "1",
    inputPosition: "top",
    theme: "noborder_dark",
    lang: "en",
  },
  stack: [
    "Node.js",
    "NestJS",
    "TypeScript",
    "MongoDB",
    "DynamoDB",
    "Python",
    "PostgreSQL",
    "Redis",
    "AWS",
    "Terraform",
    "Docker",
    "Kubernetes",
    "Helm",
    "Azure DevOps",
    "ArgoCD/FluxCD",
  ],
};

export type SiteConfig = typeof siteConfig;
