import { ArrowRight, ArrowUpRight, ChevronRight, ShieldCheck } from "lucide-react";
import { guides, type Guide } from "@/lib/guides";
import { absoluteUrl, homePaths, siteName, type PublicLocale } from "@/lib/site";
import { PublicShell } from "./public-shell";
import styles from "@/app/landing.module.css";

export default function PublicGuide({ guide, locale }: { guide: Guide; locale: PublicLocale }) {
  const english = locale === "en";
  const text = guide.copy[locale];
  const path = absoluteUrl(guide.paths[locale]);
  const homePath = homePaths[locale];
  const related = guides.filter((item) => item !== guide).slice(0, 3);

  return <PublicShell locale={locale} paths={guide.paths}>
    {path && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: siteName, item: absoluteUrl(homePath) },
        { "@type": "ListItem", position: 2, name: text.name, item: path },
      ],
    }).replace(/</g, "\\u003c") }} />}
    <article className={styles.guide}>
      <nav className={styles.breadcrumbs} aria-label={english ? "Breadcrumb" : "Lokasi halaman"}>
        <a href={homePath}>{siteName}</a><ChevronRight size={16} aria-hidden="true" />
        <span aria-current="page">{text.name}</span>
      </nav>
      <div className={styles.guideHero}>
        <div>
          <h1>{text.name}</h1>
          <p>{text.summary}</p>
          <a className={styles.primary} href={guide.entry}>{text.action}<ArrowUpRight size={18} /></a>
          <p className={styles.languageNote}><ShieldCheck size={17} />
            {english ? "Runs locally. The workspace interface is in Indonesian." : "Pemrosesan berjalan di browser tanpa mengunggah berkas."}
          </p>
        </div>
        <guide.icon size={92} strokeWidth={1.2} className={styles.guideIcon} aria-hidden="true" />
      </div>
      <div className={styles.guideColumns}>
        <section className={styles.guidePanel}>
          <h2>{english ? "How to use it" : "Cara menggunakan"}</h2>
          <ol>{text.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        </section>
        <section className={styles.guidePanel}>
          <h2>{english ? "Questions and answers" : "Tanya jawab"}</h2>
          <dl>{text.notes.map(([question, answer]) => <div key={question}><dt>{question}</dt><dd>{answer}</dd></div>)}</dl>
        </section>
      </div>
      <section className={styles.guideRelated} aria-labelledby="guide-related">
        <h2 id="guide-related">{english ? "More document tools" : "Alat dokumen lainnya"}</h2>
        <ul>{related.map((item) => <li key={item.paths.id}><a className={styles.more} href={item.paths[locale]}>
          {item.copy[locale].name} <ArrowRight size={16} />
        </a></li>)}</ul>
      </section>
    </article>
  </PublicShell>;
}
