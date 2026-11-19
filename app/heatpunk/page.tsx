import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Heatpunk Home Assessment | ApolloGrid",
  description: "ApolloGrid’s field assessment workspace for Home Energy Consultants.",
};

const workspace = "https://apollogrid-hec-fieldwork.guoyiding273.chatgpt.site/";

export default function HeatpunkEntry() {
  return (
    <main className="heatpunk-entry">
      <a className="heatpunk-home" href="/">ApolloGrid</a>
      <section className="heatpunk-intro" aria-labelledby="heatpunk-title">
        <p className="heatpunk-eyebrow">Operations · HEC fieldwork</p>
        <h1 id="heatpunk-title">Heatpunk Home Assessment</h1>
        <p>Capture room measurements and site evidence, review the survey, and hand over the record to Operations and the design team.</p>
        <p lang="zh-CN">采集房屋尺寸和现场证据，完成质检后将记录交接给运营与方案团队。</p>
        <a className="heatpunk-launch" href={workspace}>Open assessment workspace</a>
        <small>Sign in with your authorised account.</small>
      </section>
    </main>
  );
}
