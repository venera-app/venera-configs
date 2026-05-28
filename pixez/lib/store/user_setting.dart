import 'dart:io';

import 'package:pixez/constants.dart';
import 'package:pixez/er/hoster.dart';
import 'package:pixez/er/prefer.dart';
import 'package:pixez/network/api_client.dart';
import 'package:pixez/network/oauth_client.dart';
import 'package:shared_preferences/shared_preferences.dart';

class UserSetting {
  late SharedPreferences prefs;
  bool disableBypassSni = false;
  String? pictureSource = ImageHost;
  int pictureQuality = 0;
  int mangaQuality = 0;
  int themeInitState = 0;

  Future<void> askInit() async {
    prefs = await Prefer.getInstance();
    disableBypassSni = prefs.getBool('disable_bypass_sni') ?? false;
    ApiClient.Accept_Language = "zh-CN";
    await oAuthClient.createDioClient();
    await apiClient.createDioClient();
    apiClient.httpClient.options.headers[HttpHeaders.acceptLanguageHeader] =
        ApiClient.Accept_Language;
    pictureSource = disableBypassSni
        ? ImageHost
        : (prefs.getString('picture_source') ?? ImageHost);
    await Hoster.initMap();
    themeInitState = 1;
  }

  Future<void> init() async {
    prefs = await Prefer.getInstance();
    pictureSource = prefs.getString('picture_source') ?? ImageHost;
    pictureQuality = prefs.getInt('picture_quality') ?? 0;
    mangaQuality = prefs.getInt('manga_quality') ?? 0;
  }

  Future<void> setDisableBypassSni(bool value) async {
    await prefs.setBool('disable_bypass_sni', value);
    disableBypassSni = value;
  }

  Future<void> setPictureSource(String value) async {
    await prefs.setString('picture_source', value);
    pictureSource = value;
  }
}
