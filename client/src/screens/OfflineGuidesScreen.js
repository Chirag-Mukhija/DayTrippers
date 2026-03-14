import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { OFFLINE_WIKI_ARTICLES } from "../data/offlineWiki";
import { COLORS, FONTS, RADIUS, SPACING } from "../theme";

export default function OfflineGuidesScreen({ onBack }) {
  const [query, setQuery] = useState("");
  const [selectedWikiArticle, setSelectedWikiArticle] = useState(null);

  const filteredWiki = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return OFFLINE_WIKI_ARTICLES;
    return OFFLINE_WIKI_ARTICLES.filter((a) =>
      `${a.title} ${a.summary} ${a.keywords}`.toLowerCase().includes(q)
    );
  }, [query]);

  function wikiArticleToHtml(article) {
    const escapedTitle = article.title
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const escapedSummary = article.summary
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
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
            background: #0A0A0F;
            color: #F0F0F5;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            line-height: 1.6;
          }
          header {
            background: #12121A;
            border: 1px solid #2A2A3A;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 16px;
          }
          h1 {
            font-size: 22px;
            margin: 0 0 8px;
            color: #FF4B4B;
            letter-spacing: 1px;
          }
          .summary {
            margin: 0;
            color: #8B8B9E;
            font-size: 14px;
          }
          section {
            background: #1A1A24;
            border: 1px solid #2A2A3A;
            border-radius: 12px;
            padding: 14px;
            margin-bottom: 10px;
          }
          h2 {
            margin: 0 0 8px;
            color: #F0F0F5;
            font-size: 16px;
            letter-spacing: 0.5px;
          }
          p {
            margin: 0;
            color: #8B8B9E;
            font-size: 14px;
            line-height: 1.5;
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
        <View style={styles.readerHeader}>
          <Text style={styles.readerTitle}>
            {selectedWikiArticle.title.toUpperCase()}
          </Text>
        </View>
        <WebView
          source={{ html: wikiArticleToHtml(selectedWikiArticle) }}
          style={styles.webview}
          originWhitelist={["*"]}
        />
        <Pressable
          style={styles.backBtn}
          onPress={() => setSelectedWikiArticle(null)}
        >
          <Text style={styles.backText}>← BACK TO KNOWLEDGE BASE</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Hero */}
      <View style={styles.heroCard}>
        <View style={styles.heroBadgeRow}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>OFFLINE READY</Text>
          </View>
        </View>
        <Text style={styles.heroTitle}>KNOWLEDGE BASE</Text>
        <Text style={styles.heroSubtitle}>
          Search survival, medical, navigation, and fieldcraft topics
          without internet connection.
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="SEARCH TOPICS..."
          placeholderTextColor={COLORS.TEXT_MUTED}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {/* Results count */}
      <Text style={styles.resultCount}>
        {filteredWiki.length} ARTICLES FOUND
      </Text>

      {/* List */}
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
            <Text style={styles.cardDesc} numberOfLines={2}>
              {item.summary}
            </Text>
            <Text style={styles.cardArrow}>READ →</Text>
          </Pressable>
        )}
      />

      {/* Back */}
      <Pressable style={styles.backBtnPrimary} onPress={onBack}>
        <Text style={styles.backText}>← BACK TO SESSION</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.LG,
    backgroundColor: COLORS.DARK_BG,
  },

  // Hero
  heroCard: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.LG,
    padding: SPACING.LG,
    marginBottom: SPACING.MD,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
  },
  heroBadgeRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  heroBadge: {
    backgroundColor: COLORS.NEON_GREEN_DIM,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.PILL,
    borderWidth: 1,
    borderColor: "rgba(0,255,136,0.2)",
  },
  heroBadgeText: {
    color: COLORS.NEON_GREEN,
    fontWeight: "800",
    fontSize: 10,
    letterSpacing: 1.5,
    fontFamily: FONTS.MONO,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.TEXT_PRIMARY,
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroSubtitle: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 19,
  },

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.INPUT_BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: RADIUS.SM,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 13,
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONTS.MONO,
    letterSpacing: 0.5,
  },

  resultCount: {
    color: COLORS.TEXT_MUTED,
    fontSize: 10,
    fontWeight: "700",
    fontFamily: FONTS.MONO,
    letterSpacing: 1,
    marginBottom: 8,
  },

  // List
  listContent: {
    paddingBottom: 10,
  },
  card: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.MD,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
  },
  cardTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  cardDesc: {
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 18,
    fontSize: 12,
    marginBottom: 6,
  },
  cardArrow: {
    color: COLORS.NEON_RED,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    fontFamily: FONTS.MONO,
  },

  // Buttons
  backBtnPrimary: {
    marginTop: 8,
    backgroundColor: COLORS.NEON_RED,
    borderRadius: RADIUS.SM,
    padding: 14,
    alignItems: "center",
    shadowColor: COLORS.NEON_RED,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  backBtn: {
    marginTop: 8,
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.SM,
    borderWidth: 1,
    borderColor: COLORS.CARD_BORDER,
    padding: 14,
    alignItems: "center",
  },
  backText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 1,
  },

  // Reader
  readerHeader: {
    marginBottom: 10,
  },
  readerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.TEXT_PRIMARY,
    letterSpacing: 0.5,
  },
  webview: {
    flex: 1,
    borderRadius: RADIUS.MD,
    overflow: "hidden",
    backgroundColor: COLORS.DARK_BG,
  },
});
