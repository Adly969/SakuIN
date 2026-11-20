import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.adly.sakuin",
  appName: "SakuIN",
  webDir: "public",
  server: {
    url: "https://saku-in.vercel.app",
    cleartext: true,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#D4FF5A",
    },
  },
};

export default config;
