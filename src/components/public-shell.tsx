import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { homePaths, logo, siteName, type LocalizedPaths, type PublicLocale } from "@/lib/site";
import { LegacyWorkspaceLink } from "./legacy-workspace-link";
import styles from "@/app/landing.module.css";

export function PublicShell({ locale, paths, children }: {
  locale: PublicLocale;
  paths: LocalizedPaths;
  children: React.ReactNode;
}) {
  const english = locale === "en";
  const other = english ? "id" : "en";
  const home = homePaths[locale];

  return <div className={styles.landing} id="atas">
    <LegacyWorkspaceLink />
    <a className="skip-link" href="#utama">{english ? "Skip to content" : "Lewati ke konten"}</a>
    <header className={styles.header}>
      <a className={styles.brand} href={home} aria-label={siteName}>
        <Image src={logo} width={32} height={32} unoptimized alt="" />
        <span>DepUp <b>Office</b></span>
      </a>
      <nav className={styles.nav} aria-label={english ? "Site navigation" : "Navigasi situs"}>
        <a href={home + "#fitur"}>{english ? "Tools" : "Fitur"}</a>
        <a href={home + "#privasi"}>{english ? "Privacy" : "Privasi"}</a>
      </nav>
      <div className={styles.headerLinks}>
        <a className={styles.headerAction} href={paths[other]} hrefLang={other} lang={other}>{english ? "Indonesia" : "English"}</a>
        <a className={styles.headerAction} href="/office/" aria-label={english ? "Workspace" : "Ruang kerja"}><span>{english ? "Workspace" : "Ruang kerja"}</span><ArrowUpRight size={16} /></a>
      </div>
    </header>
    <main id="utama" tabIndex={-1}>{children}</main>
    <footer className={styles.footer}>
      <span>{siteName}</span>
      <div className={styles.footerLinks}>
        <a href={home + "#privasi"}>{english ? "Privacy" : "Privasi"}</a>
        <a href="mailto:depupdev@gmail.com">{english ? "Contact" : "Kontak"}</a>
        <a href={paths[other]} hrefLang={other} lang={other}>{english ? "Indonesia" : "English"}</a>
      </div>
    </footer>
  </div>;
}
