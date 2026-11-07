#!/usr/bin/env python3
"""解密 yckceo「异次元」图源里的私有加密规则。

规则形如 ``:_R002_<hex>`` / ``:_H006_<base64>`` / ``:_T004_...`` / ``:_S007_...``。
算法来自异次元 APK 的 com.wsw.cospa.utils.Cfor / Cgoto / Cimplements。

用法:
    python3 tools/decrypt_ycy.py input.json output.json
    python3 tools/decrypt_ycy.py input.json > output.json

依赖: openssl (AES-256-CBC)；RSA 使用 Python 内置整数运算，无需第三方库。
"""

import argparse
import base64
import hashlib
import json
import re
import subprocess
import sys
import urllib.parse

# Cfor.f9857new：H/T/S 系列的固定表
KEYS = {
    "S001": "F41QW5WFH3E88FFGEE22FBE34WGHF9WF",
    "S002": "P0FWIswsFGnqny5h75TMpS2pcp4Lpc1k",
    "S003": "qHjYXQxJInOb0UdYbPBWTsJdI20jkCOB",
    "S004": "CFteSRlSNwXhAsdTIdEhm87ibJOuh3DQ",
    "S005": "c26zIwWMF20xDq3VExNTLaJdPxDiieKQ",
    "S006": "YUmJ0jsShFlJVeyI3thZrj8HlRWyRcrj",
    "S007": "nrP2wkM6mpqQggW1q7EQ2oD6vjcw3Oiq",
    "S008": "dLSfJq3baOeve33H6dkqFPv0sJUI6auQ",
    "S009": "LH5C4HH2I2Uqk7FyNZzKWRarzhi3jxwq",
    "S010": "CbpvdsaeILv4tlvu4nXGkFFA2oax8gEf",
    "R001": "",
    "R002": "",
    "R003": "",
    "R004": "iZktBxUNG3QZOWRDak0bIaLQpkSLCBAu",
    "R005": "nP1lcVxFBozrkq6zoTvwzjXYiBmcu0Fo",
    "R006": "lp17FfIRIvMdK6PBxrJkHLH1fIRxAKof",
    "H001": "F41QW5WFH3E88FFGEE22FBE34WGHF9WF",
    "H002": "P0FWIswsFGnqny5h75TMpS2pcp4Lpc1k",
    "H003": "clnd8CDIs6oqq3bJG2wI6N55B8HFJyl2",
    "H004": "UFbrrNHE5Sv8HqVFhtssJjR0CCBPZ7DP",
    "H005": "ScoyV09Veuam8YPMFvA9e9pSJzTJLNOm",
    "H006": "t7UNxE8HiRWWOY1Ob9YUSJ4sfQlcU4x8",
    "T001": "F41QW5WFH3E88FFGEE22FBE34WGHF9WF",
    "T002": "P0FWIswsFGnqny5h75TMpS2pcp4Lpc1k",
    "T003": "ZOH0jEUBYu249jvCVCYrrHYEn7VGv0dn",
    "T004": "4zZQwmFX7LvF4fBwRgf3GbXUNnidclCe",
    "T005": "IfAW3JUE2OrVJbzIq0kKbnWbxl60CUZ1",
    "T006": "LbFdkUsBfYqMMEyKl6rpR83zfrUNSAse",
}

# Cimplements：R 系列的 RSA modulus / private exponent
RSA_KEYS = {
    "R001": (
        "124894949392799470526501691427201380722059386407429374904963151579445000167700084219094797780867267785897015633452737623494882167165602560066550153229779581419202243260024600553243026875623862252970534410045512718055164222767734268476307217370858508842021185622033555296345081105287930968885783895899183401631",
        "19086069456853159241873580673390497400881106826700537018310625401326552189545004503333042132561491952439938676955532641951444640195991636879317701597903178032251524558220594586042774566667098468523075912221587922761078702629673680760823904240579535052710120226686686757549111111483582028698505555454486750265",
    ),
    "R002": (
        "134637879530725842045797524508160121551609494553379149906687560348617712247282090903147805955484430250432335457792034049708343226865029205108006451147296816481047287446612470453679013649723292054233709641226286065157635394380094379354568922533499017531342766295713079603926199948346272171926131302561430658419",
        "26112192620585178072281450711216095106302279331075967543356458730352402940614904808344296925357963451151566288299214928800797970384179222599833925832853439888342640415696699869357785949087891627998411565633711986243813092664335597492895203854674537798891101584434089581685869173590440642207295109926796080873",
    ),
    "R003": (
        "129687005002893678462258796476531399533182790367431241886401469844966355386036128571070619438228618154986229861190436546865018454538596851401582310946251118113102749171640191782313442529234243995625586165944107120885398307387122000295641915645959373878533198490065094178492877982169810374840993728562031519451",
        "41468496831417976499612361550913102653728100995466516700053850528268229297492608913062177105261438913222934113113306808003163506619327030806591069291997466282358213608270495908597272131676474848064702792913802149316731747013886568532033632097590127095715137913435615888935607179182373719289689782848795732129",
    ),
    "R004": (
        "114737282646053411153191125552464961684877527566486697407657067497223857621606510099134620159886510385369743052921265046412650960670405167324511418769565986785130279303309025131430922680512927459659347040053031505170887511387363963040194542702287631882079335182228304208113000751602157929985817627734352710973",
        "6257529830441680345671809519903228547266025343004944965581553527045064209591941479192393855478193383049388957488194937091115212722220969365543661420832829565415921870538601853029528477108725351697612171310930129800532652860831639423337379483853627148984644975559139383848088176284172307975953124337029486825",
    ),
    "R005": (
        "146372144379205490318397651279575810877674630401376756713544888234448441631421195469371449557009813069179225328595244812888859210444267899624134179269439598626750554744149486431693991900726482490381030602289706414213778315170872098929393476937274144247556843764280070143422500796941791167495767154628182240551",
        "70387587411429431162998934630841684357162439757916736747268320569338844656225562442818193059095514957683718751901115978769227191460645513078175698105894729760343620214532047321719776584517760097231040938346123064264290930257656668906635959708481115861769263421653051042270366207333290378393268508256115557261",
    ),
    "R006": (
        "147016280108323395424425110933109423982167754606681218202836670921323970403694758493534062597366854555224174098104812131753688557538322792080358547319739657444425204231632640918083014064617176044848677821564756438387138009504153779014931647274809221226629782150732202102138976504029597451845107605372273052759",
        "3106162053852405941646509660274026108518469732803117732042375711466702132927191392048972316042652312548134230554380932884247688420353860558675808604636558666900217700811222405994977417661504605591182755170180239765097621852782385920349085783253187007506297779008899163668213273497487603412074635153582808353",
    ),
}

ESC = bytes([0, 10, 13, 34, 38, 92])


def char_digit(c):
    digit = "0123456789abcdef".find(c.lower())
    return digit if digit >= 0 else -1


def hex_bytes(text):
    if len(text) % 2 == 1:
        text = "0" + text
    out = bytearray()
    for i in range(0, len(text), 2):
        out.append(((char_digit(text[i]) << 4) + char_digit(text[i + 1])) & 0xFF)
    return bytes(out)


class BitReader:
    """Cgoto.Cif 的 Python 移植（7-bit 打包 + 转义）。"""

    def __init__(self, data):
        self.data = data
        self.index = 0
        self.offset = 0

    def read(self):
        if self.index >= len(self.data):
            return None
        byte = self.data[self.index]
        shift = self.offset
        value = ((byte & (254 >> shift)) << shift) >> 1
        next_offset = shift + 7
        self.offset = next_offset
        if next_offset < 8:
            return value & 0xFF
        rest = next_offset - 8
        self.offset = rest
        next_index = self.index + 1
        self.index = next_index
        if next_index >= len(self.data):
            return value & 0xFF
        return (
            (((self.data[next_index] & (65280 >> rest)) & 0xFF) >> (8 - rest))
            | value
        ) & 0xFF

    def decode(self):
        out = bytearray()
        while self.index < len(self.data):
            value = self.read()
            esc = ESC.find(value)
            if esc != -1:
                value2 = self.read()
                if value2 is None:
                    prefix = 0xDE
                else:
                    prefix = ((esc & 7) << 2) | 0xC2
                    value = value2
                out.append((prefix | (1 if (value & 0x80) > 0 else 0)) & 0xFF)
                out.append(((value & 63) | 0x80) & 0xFF)
            else:
                out.append(value)
        return out.decode("utf-8", "replace")


def custom_decode(data):
    return BitReader(data).decode()


def md5_hex(text):
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def aes_decrypt(payload, key):
    clean = re.sub(r"\s+", "", payload)
    data = base64.b64decode(clean + "=" * ((4 - len(clean) % 4) % 4))
    proc = subprocess.run(
        [
            "openssl",
            "enc",
            "-aes-256-cbc",
            "-d",
            "-K",
            key.encode().hex(),
            "-iv",
            b"1234567890123456".hex(),
        ],
        input=data,
        capture_output=True,
    )
    if proc.returncode != 0:
        raise ValueError(proc.stderr.decode("utf-8", "replace").strip()[:120])
    return proc.stdout.decode("utf-8", "replace")


def rsa_decrypt(payload, modulus, exponent):
    n = int(modulus)
    d = int(exponent)
    block_size = (n.bit_length() + 7) // 8
    data = hex_bytes(payload)
    out = bytearray()
    for offset in range(0, len(data), block_size):
        block = data[offset : offset + block_size]
        message = pow(int.from_bytes(block, "big"), d, n)
        encoded = message.to_bytes(block_size, "big")
        # PKCS#1 v1.5: 00 02 PS 00 M
        if encoded[0] != 0 or encoded[1] != 2:
            raise ValueError("bad RSA padding")
        sep = encoded.find(b"\x00", 2)
        if sep < 0:
            raise ValueError("RSA separator not found")
        out += encoded[sep + 1 :]
    return urllib.parse.unquote_plus(out.decode("utf-8", "replace"))


def decrypt_value(code, payload, source_url):
    if code.startswith("R"):
        modulus, exponent = RSA_KEYS[code]
        return rsa_decrypt(payload, modulus, exponent)
    if code.startswith("H"):
        key = md5_hex(custom_decode(hex_bytes(source_url)) + KEYS[code])
        return aes_decrypt(payload, key)
    if code.startswith("T"):
        key = md5_hex(custom_decode(hex_bytes(source_url)) + KEYS[code] + "648")
        return aes_decrypt(payload, key)
    if code.startswith("S"):
        return aes_decrypt(payload, KEYS[code])
    raise ValueError("unknown code " + code)


def decrypt_field(value, source_url):
    match = re.match(r":_([A-Z]\d{3})_(.*)$", value, re.S)
    if not match:
        return value, None
    code, payload = match.group(1), match.group(2)
    return decrypt_value(code, payload, source_url), code


def decrypt_sources(sources):
    decrypted = []
    stats = {}
    failures = []
    for source in sources:
        url = source.get("bookSourceUrl", "") or ""
        result = dict(source)
        for key, value in list(source.items()):
            if not isinstance(value, str) or not re.match(r":_[A-Z]\d{3}_", value):
                continue
            code = re.match(r":_([A-Z]\d{3})_", value).group(1)
            try:
                plain, _ = decrypt_field(value, url)
                result[key] = plain
                stats[code] = stats.get(code, 0) + 1
            except Exception as error:  # noqa: BLE001 - 输出失败详情
                failures.append((source.get("bookSourceName"), key, code, str(error)[:100]))
        decrypted.append(result)
    return decrypted, stats, failures


def main():
    parser = argparse.ArgumentParser(description="解密异次元图源的私有加密规则")
    parser.add_argument("input", help="输入 JSON（yckceo /yiciyuan/tuyuan/jsons 的数组）")
    parser.add_argument("output", nargs="?", help="输出 JSON，省略则写到 stdout")
    parser.add_argument("--quiet", action="store_true", help="不输出统计信息")
    args = parser.parse_args()

    with open(args.input, encoding="utf-8") as file:
        sources = json.load(file)
    if not isinstance(sources, list):
        raise SystemExit("输入 JSON 必须是数组")

    decrypted, stats, failures = decrypt_sources(sources)
    text = json.dumps(decrypted, ensure_ascii=False, indent=1)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as file:
            file.write(text)
    else:
        print(text)

    if not args.quiet:
        print(f"解密字段: {sum(stats.values())} {stats}", file=sys.stderr)
        print(f"失败字段: {len(failures)}", file=sys.stderr)
        for item in failures[:20]:
            print("  ", item, file=sys.stderr)


if __name__ == "__main__":
    main()
