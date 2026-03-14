import React, { useMemo, useState } from "react";
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { WebView } from "react-native-webview";
import { OFFLINE_WIKI_ARTICLES } from "../data/offlineWiki";

export default function OfflineGuidesScreen({ onBack }) {
  const [query, setQuery] = useState("");
  const [selectedWikiArticle, setSelectedWikiArticle] = useState(null);

  const filteredWiki = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return OFFLINE_WIKI_ARTICLES;
    return OFFLINE_WIKI_ARTICLES.filter((a) =>
      (`${a.title} ${a.summary} ${a.keywords}`).toLowerCase().includes(q)
    );
  }, [query]);

  function wikiArticleToHtml(article) {
    const escapedTitle = article.title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const escapedSummary = article.summary.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const sectionsHtml = article.sections
      .map(
        (section) => `
        <section>
          <h2>${section.heading.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</h2>
          <p>${section.body.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
        </section>
      `
      )
      .join("\n");

    return `
      <!doctype html>
      <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapedTitle}</title>
        <style>
          body {
            margin: 0;
            padding: 18px 16px 28px;
            background: #f8fafc;
            color: #0f172a;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            line-height: 1.55;
          }
          header {
            background: linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%);
            border: 1px solid #bae6fd;
            border-radius: 14px;
            padding: 14px;
            margin-bottom: 14px;
          }
          h1 {
            font-size: 26px;
            margin: 0 0 8px;
            color: #0c4a6e;
          }
          .summary {
            margin: 0;
            color: #334155;
            font-size: 15px;
          }
          section {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 12px;
            margin-bottom: 10px;
          }
          h2 {
            margin: 0 0 8px;
            color: #0f172a;
            font-size: 18px;
          }
          p {
            margin: 0;
            color: #334155;
            font-size: 15px;
          }
        </style>
      </head>
      <body>
        <header>
          <h1>${escapedTitle}</h1>
          <p class="summary">${escapedSummary}</p>
        </header>
        ${sectionsHtml}
      </body>
      </html>
    `;
  }

  if (selectedWikiArticle) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.readerTitle}>{selectedWikiArticle.title}</Text>
        <WebView
          source={{ html: wikiArticleToHtml(selectedWikiArticle) }}
          style={styles.webview}
          originWhitelist={["*"]}
        />
        <Pressable style={styles.backBtnSecondary} onPress={() => setSelectedWikiArticle(null)}>
          <Text style={styles.backText}>Back To Wikipedia</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.heroBadge}>OFFLINE READY</Text>
        <Text style={styles.title}>Offline Knowledge Base</Text>
        <Text style={styles.subtitle}>
          Search encyclopedia-style survival, medical, navigation, and fieldcraft topics without internet.
        </Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Search offline topics"
        value={query}
        onChangeText={setQuery}
      />

      <View style={styles.wikiNoteCard}>
        <Text style={styles.wikiNoteTitle}>Offline Wikipedia</Text>
        <Text style={styles.wikiNoteText}>
          Disaster, medical, fieldcraft, navigation, communication, and practical survival topics are bundled locally for fully offline search.
        </Text>
      </View>

      <FlatList
        data={filteredWiki}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => setSelectedWikiArticle(item)}
          >
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDesc}>{item.summary}</Text>
          </Pressable>
        )}
      />

      <Pressable style={styles.backBtnPrimary} onPress={onBack}>
        <Text style={styles.backText}>Back To Session</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#eef2ff",
  },
  heroCard: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  heroBadge: {
    color: "#93c5fd",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#f8fafc",
    marginBottom: 4,
  },
  subtitle: {
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 10,
  },
  wikiNoteCard: {
    backgroundColor: "#e0f2fe",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bae6fd",
    padding: 10,
    marginBottom: 8,
  },
  wikiNoteTitle: {
    color: "#0c4a6e",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 2,
  },
  wikiNoteText: {
    color: "#0f172a",
    fontSize: 12,
    lineHeight: 18,
  },
  listContent: {
    paddingBottom: 10,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 9,
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  cardTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  cardDesc: {
    color: "#334155",
    lineHeight: 19,
    fontSize: 13,
  },
  backBtnPrimary: {
    marginTop: 8,
    backgroundColor: "#1d4ed8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e40af",
    padding: 12,
    alignItems: "center",
  },
  backBtnSecondary: {
    marginTop: 8,
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  backText: {
    color: "white",
    fontWeight: "800",
  },
  readerTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 10,
  },
  webview: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "white",
  },
});
