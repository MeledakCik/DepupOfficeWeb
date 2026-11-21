import Image from "next/image";
import { ArrowDown, ArrowRight, ArrowUpRight, Camera, FileCheck2, FileSpreadsheet, FileText, Folder, ShieldCheck, Smartphone } from "lucide-react";
import { landingCopy } from "@/lib/landing-copy";
import { guides } from "@/lib/guides";
import { absoluteUrl, homePaths, logo, siteName, type PublicLocale } from "@/lib/site";
import { PublicShell } from "./public-shell";
import styles from "@/app/landing.module.css";

export default function PublicLanding({ locale }: { locale: PublicLocale }) {
  const text = landingCopy[locale];
  const homeUrl = absoluteUrl("/");
  const privacyIcons = [Folder, FileCheck2, Smartphone];

  return <PublicShell locale={locale} paths={homePaths}>
    {homeUrl && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        ...(locale === "id" ? [{ "@type": "WebSite", "@id": homeUrl + "#website", name: siteName, url: homeUrl, inLanguage: ["id-ID", "en"] }] : []),
        { "@type": "WebApplication", "@id": homeUrl + "#app", name: siteName, url: absoluteUrl("/office/"), image: absoluteUrl(logo), applicationCategory: "BusinessApplication", operatingSystem: "Any", inLanguage: "id-ID", isAccessibleForFree: true },
      ],
    }).replace(/</g, "\\u003c") }} />}
    <section className={styles.hero} aria-labelledby="hero-heading">
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}><span /> {text.eyebrow}</p>
        <h1 id="hero-heading">{text.heading[0]}<br /><span>{text.heading[1]}</span></h1>
        <p className={styles.heroDescription}>{text.intro}</p>
        <div className={styles.heroActions}>
          <a className={styles.primary} href="/office/">{text.open} <ArrowUpRight size={19} /></a>
          <a className={styles.more} href="#fitur">{text.explore} <ArrowDown size={17} /></a>
        </div>
        <p className={styles.local}><ShieldCheck size={16} /> {text.local}</p>
        {text.languageNote && <p className={styles.languageNote}>{text.languageNote}</p>}
      </div>
      <div className={styles.scene} aria-hidden="true">
        <div className={styles.orbit} />
        <div className={styles.orbitInner} />
        <picture className={styles.sculpture}>
          <source media="(max-width: 640px)" srcSet="/brand/glass-pages-480.webp" />
          <Image src="/brand/glass-pages-880.webp" alt="" width={880} height={1040} unoptimized loading="eager" fetchPriority="high" />
        </picture>
        <span className={styles.sceneTag}><FileText size={17} /> PDF</span>
        <span className={styles.sceneTag}><FileSpreadsheet size={17} /> XLSX</span>
        <span className={styles.sceneTag}><Camera size={17} /> Scan</span>
      </div>
    </section>

    <section className={styles.features} id="fitur" aria-labelledby="features-heading">
      <div className={styles.sectionTitle}>
        <h2 id="features-heading">{text.toolsTitle}</h2>
        <a className={styles.more} href="/office/#alat">{text.toolsLink} <ArrowRight size={18} /></a>
      </div>
      <div className={styles.featureGrid}>
        {guides.map(({ paths, copy, icon: Icon }) => <a href={paths[locale]} className={styles.feature} key={paths.id}>
          <span className={styles.featureIcon}><Icon size={24} /></span>
          <h3>{copy[locale].name}</h3>
          <p>{copy[locale].summary}</p>
          <span className={styles.featureAction}>{copy[locale].action}<ArrowUpRight size={16} /></span>
        </a>)}
      </div>
    </section>

    <section className={styles.showcase} aria-labelledby="showcase-heading">
      <div className={styles.showcaseCopy}>
        <h2 id="showcase-heading">{text.showcaseTitle}</h2>
        <p>{text.showcaseText}</p>
        <a className={styles.more} href="/office/">{text.showcaseAction} <ArrowUpRight size={17} /></a>
      </div>
      <figure className={styles.devices}>
        <Image className={styles.desktopPreview} src="/brand/workspace-desktop.webp" alt={text.desktopAlt} width={1060} height={658} unoptimized fetchPriority="low" />
        <Image className={styles.mobilePreview} src="/brand/workspace-mobile.webp" alt={text.mobileAlt} width={308} height={667} unoptimized fetchPriority="low" />
      </figure>
    </section>

    <section className={styles.privacy} id="privasi" aria-labelledby="privacy-heading">
      <div className={styles.privacyCopy}>
        <ShieldCheck size={29} />
        <h2 id="privacy-heading">{text.privacyTitle}</h2>
        <p>{text.privacyText}</p>
      </div>
      <div className={styles.privacyDetails}>
        {text.privacyItems.map(([title, description], index) => {
          const Icon = privacyIcons[index];
          return <article key={title}><Icon size={22} /><div><h3>{title}</h3><p>{description}</p></div></article>;
        })}
      </div>
    </section>

    <section className={styles.final} aria-labelledby="final-heading">
      <h2 id="final-heading">{text.finalTitle}</h2>
      <a className={styles.primary} href="/office/">{text.open} <ArrowUpRight size={18} /></a>
    </section>
  </PublicShell>;
}
