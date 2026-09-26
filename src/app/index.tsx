import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedIcon } from "@/components/animated-icon";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { WebBadge } from "@/components/web-badge";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";

import { OPENROUTER_API_KEY } from "@/secrets";

const OPENROUTER_MODEL = "openrouter/free";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

async function askOpenRouter(userText: string): Promise<string> {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: "user", content: userText }],
      }),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export default function HomeScreen() {
  const [recognizing, setRecognizing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const latestTranscript = useRef("");
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useSpeechRecognitionEvent("start", () => setRecognizing(true));
  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results[0]?.transcript ?? "";
    setTranscript(text);
    latestTranscript.current = text;
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    silenceTimer.current = setTimeout(() => {
      ExpoSpeechRecognitionModule.stop();
    }, 1500);
  });
  useSpeechRecognitionEvent("speechend", () => {
    ExpoSpeechRecognitionModule.stop();
  });
  useSpeechRecognitionEvent("end", () => {
    setRecognizing(false);
    handleFinalTranscript(latestTranscript.current);
  });
  useSpeechRecognitionEvent("error", (event) => {
    console.log("speech recognition error:", event.error, event.message);
  });

  const handleFinalTranscript = async (text: string) => {
    if (!text.trim()) return;
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMessage]);
    setTranscript("");
    latestTranscript.current = "";
    setLoading(true);

    try {
      const reply = await askOpenRouter(text);
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: reply,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.log("openrouter error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePress = async () => {
    if (recognizing) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }

    const { granted } =
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) return;

    setTranscript("");
    latestTranscript.current = "";
    ExpoSpeechRecognitionModule.start({
      lang: "ar-SA",
      interimResults: true,
      continuous: true,
      requiresOnDeviceRecognition: false,
    });
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <AnimatedIcon />
        </ThemedView>

        <FlatList
          style={styles.chatList}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ThemedView
              type="backgroundElement"
              style={[
                styles.messageBubble,
                item.role === "user"
                  ? styles.userBubble
                  : styles.assistantBubble,
              ]}
            >
              <ThemedText>{item.content}</ThemedText>
            </ThemedView>
          )}
        />

        {loading && <ActivityIndicator />}

        <ThemedView type="backgroundElement" style={styles.stepContainer}>
          <ThemedText>
            {transcript || (recognizing ? "بيسمعك..." : "دوس وابدأ اتكلم")}
          </ThemedText>
        </ThemedView>

        <Pressable onPress={handlePress}>
          <ThemedText type="title">{recognizing ? "وقف" : "اتكلم"}</ThemedText>
        </Pressable>

        {Platform.OS === "web" && <WebBadge />}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    flexDirection: "row",
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: "center",
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  chatList: {
    flex: 1,
    alignSelf: "stretch",
  },
  messageBubble: {
    padding: Spacing.three,
    borderRadius: Spacing.four,
    marginBottom: Spacing.two,
    maxWidth: "85%",
  },
  userBubble: {
    alignSelf: "flex-end",
  },
  assistantBubble: {
    alignSelf: "flex-start",
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: "stretch",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
});
