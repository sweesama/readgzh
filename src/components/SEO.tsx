import { Helmet } from "react-helmet-async";

interface SEOProps {
  title: string;
  description: string;
  path: string; // e.g. "/articles"
  ogType?: "website" | "article";
  ogImage?: string;
  jsonLd?: Record<string, any> | Record<string, any>[];
  noindex?: boolean;
}

const SITE = "https://readgzh.site";
const DEFAULT_OG_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/z3lposugwgZVyVF2Fpv0xxHMdCo1/social-images/social-1772211146277-3.webp";

export const SEO = ({
  title,
  description,
  path,
  ogType = "website",
  ogImage = DEFAULT_OG_IMAGE,
  jsonLd,
  noindex,
}: SEOProps) => {
  const url = `${SITE}${path}`;
  const jsonLdArr = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, follow" />}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={ogImage} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      {jsonLdArr.map((obj, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(obj)}
        </script>
      ))}
    </Helmet>
  );
};

export default SEO;
