# Kisokos communication-line cards: technical value check (2026-11-25)

Source of cards: `Kisokos/kommunikacios-vonalak/vonalak.json` (27 cards). All sources read 2026-11-25 through web search summaries (not full-page reads); "what the source says" and "what I conclude" are kept in separate columns. Many sources are secondary (Wikipedia, vendor notes); where the standard itself was not reached the verdict says so. No client data was used in any search.

## Summary
- Most headline numbers hold: DALI (1200 bit/s, 250 mA, 64 addr), KNX (1000 m segment, 64 devices, ~29 V), RS-485 (32 UL, 120 ohm, 1200 m at low speed), M-Bus (300-9600 baud, polarity free), PoE (15.4/30/60/90 W), CENELEC bands, VDSL2 profile frequencies, GPON/XGS-PON wavelengths, LNB 13/18 V + 22 kHz + 950-2150 MHz, 6 GHz 5945-6425 MHz, HDMI 18/48 Gbit/s.
- Corrections found: (1) DALI 300 m is the distance between any two devices (1.5 mm2, 2 V drop), not a total length; (2) KNX card lacks the 350 m device-to-power-supply and 700 m device-to-device limits that installers hit before the 1000 m; (3) Wi-Fi 5 GHz band is not contiguous in the EU (5350-5470 MHz unavailable) and DFS starts at 5250 MHz, not only "upper channels"; (4) VDSL2 band top should be 35.328 MHz, not 35 MHz; (5) 1-Wire standard speed is quoted 15.3/16.3 kbit/s by Analog Devices notes, not 15.4; (6) HomePlug AV2 2-86 MHz is the spec ceiling, shipping silicon often 2-68 MHz.
- Not reachable by these searches (see Not verified): EN 50174-2, 4x bend radius, T568A/B, 90+10 m split, 44-57 V on the card (not on card), 1-Wire 4.7 kohm, Z-Wave 868.42 MHz and duty cycles, RFID, IR, HDBaseT 100 m / IEEE 1911, OM3/OM4, SC/APC green, Hungarian DVB-T 470-694 MHz as current allocation.

## Claim table
| card id + field | our claim (quote) | finding (what the source says) | verdict | confidence | source |
|---|---|---|---|---|---|
| ethernet rate | "10 Gbit/s rövidebb távon (Cat6, 250 MHz)" | Cat6 specified to 250 MHz; 10GBASE-T about 55 m in favourable alien crosstalk, about 37 m in hostile (bundled) conditions | confirmed (add 55/37 m if wanted) | medium | https://www.wikipedia.org/wiki/Cat_6A ; https://www.l-com.com/resources/blog/cat6-vs-cat6a-data-center-horizontal-runs |
| ethernet rate | "10 Gbit/s 100 m-en (Cat6A, 500 MHz)" | Cat6A characterised to 500 MHz, 10GBASE-T over full 100 m channel | confirmed | high | https://commscope.com/insights/the-enterprise-source/cat6a-the-fact-file ; https://www.wikipedia.org/wiki/Cat_6A |
| ethernet rate | "1 Gbit/s (Cat5e, 100 MHz)" | no Cat5e figure returned by the search | not verifiable here (widely known, ISO/IEC 11801 / TIA) | low | n/a |
| ethernet distance | "100 m csatorna (90 m fix szakasz + 10 m patch kábel)" | IEEE material confirms 100 m channel includes cords; the 90+10 split not shown | not verifiable here | low | https://www.ieee802.org/3/minutes/mar05/0305_clause55-link.pdf |
| ethernet install | EN 50174-2 separation; "négyszerese" bend radius; T568A/B | not searched/returned | not verifiable here | n/a | n/a |
| poe rate | "802.3af 15,4 W · 802.3at 30 W · 802.3bt 60 W és 90 W (a forrás oldalán)" | Type 3 60 W PSE gives about 51 W at PD; Type 4 90 W PSE gives 71.3 W at PD. PSE voltage 44-57 V (af), 50-57 V (at, Type 3), 52-57 V (Type 4). af PD power 12.95 W (rounded 13 W) | confirmed (15.4 W / 30 W / 60 W / 90 W are PSE-side values) | high | https://ethernetalliance.org/wp-content/uploads/2019/12/WP_EA_Overview8023bt_V2p1_FINAL.pdf ; https://www.wikiwand.com/en/802.3af ; https://www.ti.com/product/TPS2372 |
| poe trap | "a teljesítmény ... a végén kisebb, mint a switchnél" | the 18.7 W loss at 90 W over 100 m cable is stated | confirmed | high | https://www.ti.com/product/TPS2372 |
| knx-tp rate | "9600 bit/s" | TP1 9600 bit/s (consistent, not contradicted) | confirmed | medium | https://knx.org/news/new-knx-tp1-256-topology-more-devices-and-fewer-line-repeaters |
| knx-tp power | "SELV", ~30 V DC | bus supply output DC 29 V (21...30 V) | confirmed | high | https://sid.siemens.com/r/A6V13193565/20347804683___en-US_25568984971 |
| knx-tp distance | "vonalszegmensenként legfeljebb 1000 m kábel" | total cable per line segment 1000 m; BUT device to power supply max 350 m and device to device max 700 m | confirmed, but incomplete (installer trap) | high | https://store.chipkin.com/articles/knx-topology ; https://www.professionisti.bticino.it/sites/default/files/2022-06/Norme%20di%20installazione.pdf |
| knx-tp devices | 64 devices per segment (task item) | 64 per segment consistent; newer TP1-256 topology allows more | confirmed | medium | https://knx.org/news/new-knx-tp1-256-topology-more-devices-and-fewer-line-repeaters |
| knx-tp cable | "J-Y(St)Y 2 × 2 × 0,8 mm, zöld" | green KNX bus cable named by vendor manuals; colour not explicitly returned | confirmed (vendor docs), colour not seen | medium | https://Manualslib.com/manual/1788865/Siemens-Rxb-Series.html?page=22 |
| knx-tp bands | [2000, 20000] Hz | not checked | not verifiable here | n/a | n/a |
| dali rate | "1200 bit/s" | fixed 1200 bit/s, +/-10 % | confirmed | high | https://en.wikipedia.org/wiki/Digital_Addressable_Lighting_Interface |
| dali power | "legfeljebb 250 mA" | current-limited supply up to 250 mA, typically 16 V (range 9.5-22.5 V) | confirmed | high | https://dali-alliance.org/tech-notes/cable-length.html |
| dali addresses | 64 short addresses | up to 64 individual addresses (0-63) | confirmed | high | https://en.wikipedia.org/wiki/Digital_Addressable_Lighting_Interface |
| dali distance | "legfeljebb 300 m (a keresztmetszettől függ)" | DALI Alliance: recommended max distance between ANY TWO devices 300 m at 1.5 mm2 and 250 mA; total bus cable can be longer; limit is max 2 V drop | corrected (wording) | high | https://dali-alliance.org/tech-notes/cable-length.html |
| dali install | "futhat a hálózati erekkel egy kábelben" | DALI is basic insulation, mains cable allowed; separate source not re-read here | confirmed by the DALI Alliance guide context, not re-read | medium | https://www.dali-alliance.org/data/downloadables/4/3/6/diiase001a-specifying-with-dali-a-lighting-designers-guide.pdf |
| rs485-modbus | "legfeljebb kb. 1200 m kis sebességen" | 4000 ft / 1200 m at about 100 kbit/s or lower; 10 Mbit/s only at about 12 m; rule of thumb speed x length < 10^8 | confirmed | high | https://www.tij.co.jp/jp/lit/SLLA272 ; https://www.Wikipedia.org/wiki/RS485 |
| rs485-modbus topology | "lánc ... 120 Ω lezárás" | daisy chain, 120 ohm at both trunk ends only; 32 unit loads (12 kohm); 1/8 UL parts allow 256 | confirmed | high | https://www.tij.co.jp/jp/lit/SLLA272 |
| mbus rate | "300–9600 bit/s, jellemzően 2400" | 300-9600 baud, typical 2400 | confirmed | medium | https://www.wachendorff-prozesstechnik.de/en/technology/fieldbus-the-success-story/m-bus-fieldbus-technology/ |
| mbus (task) | polarity independent | slave interfaces polarity independent; idle 36 V, space about 24 V | confirmed | high | https://m-bus.com/documentation-wired/04-physical-layer |
| mbus power | "a mester tápláléja a buszt" | master supplies the bus voltage (36 V mark): consistent, not an explicit sentence in the results | confirmed (indirect) | medium | https://m-bus.com/documentation-wired/04-physical-layer |
| onewire rate | "15,4 kbit/s (overdrive 125 kbit/s)" | ADI notes: standard speed up to 16.3 kbit/s (UART masters) or 15.3 kbit/s reference; overdrive 125 kbit/s reference | corrected (soften to "kb. 15-16") | medium | https://www.analog.com/en/resources/technical-articles/determining-the-recovery-time-for-multipleslave-1wirereg-networks.html ; https://www.analog.com/en/resources/app-notes/reading-and-writing-1wirereg-devices-through-serial-interfaces.html |
| onewire install | "4,7 kΩ körüli felhúzó" | ADI refers to AN4255 for pull-up choice; value not seen | not verifiable here (4.7 kohm is the usual datasheet value) | low | https://www.analog.com/en/resources/design-notes/1wirereg-extended-network-standard.html |
| onewire (ADI) | overdrive | ADI: overdrive intended only for very short connections | confirmed (useful trap) | medium | same ADI notes |
| vdsl2 bands | [25000, 35000000] | 17a = 17.664 MHz, 4096 tones x 4.3125 kHz; 35b = 35.328 MHz, 8192 tones; 35b in G.993.2 Amd 1 (Nov 2015), Annex Q | corrected (fmax 35.328 MHz) | medium (Wikipedia + ITU TOC, not the normative table) | https://en.wikipedia.org/wiki/VDSL ; https://itu.int/dms_pubrec/itu-t/rec/g/T-REC-G.993.2-201603-S!Amd2!TOC-HTM-E.htm |
| plc-szuksavu bands | [3000, 95000] | CENELEC A 3-95 kHz (utilities only), B 95-125, C 125-140 (CSMA/CA mandatory), D 140-148.5 kHz (B-D consumer) | confirmed | high | https://arxiv.org/pdf/1602.09019.pdf |
| plc-szuksavu standard | "ITU-T G.9903 (G3-PLC), G.9904 (PRIME)" | G3-PLC and PRIME configs for CENELEC A/B seen (Microchip); the G.9903/G.9904 numbers not re-read | confirmed (technology), numbers not re-read | medium | https://onlinedocs.microchip.com/oxy/GUID-32027C30-4315-4CFB-98CC-182810A6C695-en-US-4/GUID-053CF5E7-04BD-4C01-BCA7-9AFF4FA1A69D.html |
| plc-szelessavu bands | [2000000, 86000000] | HomePlug AV2 up to 86.13 MHz (The Register); other sources 2-68 MHz for shipping chips; IEEE 1901 base 2-30 MHz with optional extension to 50 MHz | partly confirmed (86 MHz is spec ceiling; add practical note) | medium | https://www.theregister.co.uk/2013/02/05/feature_powerline_networking_the_next_generation/ ; https://itwissen.info/en/AV2-standard-HomePlug-AV2-123461.html |
| koax-sat bands/power | "950–2150 MHz", "13/18 V", 22 kHz | 13 V / 18 V selects polarisation, 22 kHz tone selects band; IF low 950-1950, high 1100-2150 MHz (LO 9750/10600) | confirmed | high | https://st.com/resource/en/application_note/an1230-lnb-supply-and-control-voltage-regulator-parallel-interface-stmicroelectronics.pdf ; https://www.groupe-cahors.com/sites/default/files/cahors_cata_ced_2022_lnbs-2022.pdf |
| koax-sat standard | "EN 50494 / EN 50607" | vendors cite SCR per EN 50494 and dCSS up to 32 receivers per EN 50607; standards not read | confirmed (vendor level) | medium | https://manualmachine.com/technisat/scrlnb/8072004-technische-details |
| koax-tv bands | [47e6, 862e6] | not searched | not verifiable here | n/a | n/a |
| koax-tv install | "700–800 MHz ... zavarhat" | 694-790 MHz was cleared of terrestrial TV for mobile (5G); TV moved on 6 Sept 2020; 700 MHz licences won in 2020 auction | confirmed | high | https://english.nmhh.hu/article/201919/The_national_digital_terrestrial_television_networks_are_being_renewed ; https://cms.law/en/hun/legal-updates/hungary-holds-5g-auction-with-magyar-telekom-telenor-and-vodafone-winning-licences |
| (no card) DVB-T UHF | 470–694 MHz in Hungary | 694-790 MHz freed; lower limit 470 not shown in results, DVB-T/DVB-T2 networks to 2032 (12 years from 6 Sept 2020) | partly confirmed | medium | https://english.nmhh.hu/article/202746/Expiring_usage_rights_of_national_digital_terrestrial_television_networks_available_for_tender_applications |
| radio-433, radio-868 | 433.05-434.79; 863-870; Z-Wave 868.42; duty cycles | ERC/REC 70-03 is the governing document; current Annex 1 values and Z-Wave channel not retrieved. Old ECC Report 37 data (1 % / 0.1 %) is dated | not verifiable here | n/a | https://docdb.cept.org/download/4444 |
| ism-24 bands | [2400e6, 2483.5e6] | not searched | not verifiable here | n/a | n/a |
| wifi-5ghz bands | [5150e6, 5725e6] | EU: 5150-5350 and 5470-5725 MHz; DFS and TPC required above 5250 MHz in 5150-5350 and for 5470-5725 (ECC/DEC/(04)08, dated 2004) | corrected (not contiguous) | medium | https://docdb.cept.org/download/3450 |
| wifi-5ghz trap | "A felső csatornákon radarvédelmi szabály (DFS)" | DFS starts at 5250 MHz (channels 52-64 and 100-140), not only the top | corrected (wording) | medium | https://docdb.cept.org/download/3450 |
| wifi-6ghz bands | [5945e6, 6425e6] | EU Decision 2021/1067: LPI indoor 23 dBm EIRP, VLP 1 dBm indoor/outdoor; amended by 2024/3157 and 2025/913 | confirmed | high | https://eur-lex.europa.eu/eli/dec_impl/2021/1067/oj/eng |
| dect bands | [1880e6, 1900e6] | not searched | not verifiable here | n/a | n/a |
| mobilhalozat bands | [703e6, 960e6],[1710e6, 2690e6],[3400e6, 3800e6] | HU: 700 MHz (2020 auction), 2100 MHz (renewal decision 26 Mar 2026, 15 y), 3400-3800 MHz (DIGI/Vodafone, 2016, to 2034), 800 + 2600 MHz (2014 tender; 2600 MHz got no bids in 2020), 900/1800 MHz tender Jan 2021 | confirmed (broadly; exact sub-blocks not checked) | medium | https://english.nmhh.hu/article/258448/Renewal_in_the_2100_MHz_frequency_band ; https://english.nmhh.hu/article/170832/NMHH_Two_bidders_won_80_MHz_in_the_34003800_MHz_band |
| rfid, infra-taviranyito | 125 kHz / 13.56 MHz; 940 nm, 36-40 kHz | not searched | not verifiable here | n/a | n/a |
| optika-egymodusu bands | GPON 1490 down / 1310 up, 1550 RF video, XGS-PON 1577/1270 | GPON 1490/1310 with 1550 overlay confirmed; XGS-PON base plan down 1575-1580 nm, up 1260-1280 nm (nominal 1578 +/-3 / 1270 +/-10); optional plan down 1480-1500, up 1300-1320 nm | confirmed (nominal values); band widths in the card are narrower than the standard bands | medium | https://www.thefoa.org/tech/ref/appln/FTTH-PON.html ; https://www.itu.int/dms_pub/itu-t/oth/0B/04/T0B040000382C01PDFE.pdf |
| optika-egymodusu rate | "GPON: 2,5 Gbit/s le, 1,25 Gbit/s fel · XGS-PON 10 Gbit/s" | not re-read | not verifiable here (standard G.984 / G.9807.1) | n/a | n/a |
| optika (G.652/G.657, SC/APC green), optika-multimodusu (OM3/OM4 850 nm) | as written | not searched | not verifiable here | n/a | n/a |
| hdmi rate | "HDMI 2.0: 18 Gbit/s · HDMI 2.1: 48 Gbit/s" | retailer/comparison charts: 18 and 48 Gbit/s; Ultra High Speed cable 48 Gbit/s | confirmed (weak sources; hdmi.org not read) | medium | https://www.ttl-network.de/wp-content/uploads/2024/03/HDMI-2.1-Whitepaper_ENG.pdf |
| hdmi distance/standard | "HDBaseT-vel 100 m", "HDBaseT (IEEE 1911)" | nothing returned | not verifiable here | n/a | n/a |

## Corrections to apply
Apply only after the owner confirms; wording is Hungarian, in the card's style.

1. `dali` distance
   - Replace: `legfeljebb 300 m (a keresztmetszettől függ)`
   - With: `két eszköz között legfeljebb 300 m 1,5 mm²-es vezetéken (a feszültségesés legfeljebb 2 V); az összes kábel ennél hosszabb is lehet`
2. `knx-tp` distance
   - Replace: `vonalszegmensenként legfeljebb 1000 m kábel`
   - With: `vonalszegmensenként legfeljebb 1000 m kábel; a busztáptól legfeljebb 350 m-re lehet eszköz, két eszköz között legfeljebb 700 m`
   - Optionally add a trap: `A 350 m-es és a 700 m-es korlát gyakran előbb elfogy, mint az 1000 m: a busztápot a vonal közepére tedd.`
3. `wifi-5ghz` bands
   - Replace: `[[5150000000, 5725000000]]`
   - With: `[[5150000000, 5350000000], [5470000000, 5725000000]]`
   - Trap replace: `A felső csatornákon radarvédelmi szabály (DFS) van: a pont ideiglenesen csatornát válthat.`
   - With: `5250 MHz fölött (a 52–64. és a 100–140. csatornán) radarvédelmi szabály (DFS) van: a pont ideiglenesen csatornát válthat.`
4. `vdsl2` bands
   - Replace: `[[25000, 35000000]]`
   - With: `[[25000, 35328000]]`
5. `onewire` rate
   - Replace: `15,4 kbit/s (overdrive módban 125 kbit/s)`
   - With: `kb. 15–16 kbit/s (overdrive módban 125 kbit/s, csak nagyon rövid vezetéken)`
6. `plc-szelessavu` bands (optional, low priority)
   - Keep `[[2000000, 86000000]]` (spec ceiling); add to a trap: `A HomePlug AV2 előírásban 86 MHz a felső határ, a kapható lapkák gyakran csak 68 MHz-ig mennek; az IEEE 1901 alapsávja 2–30 MHz.`
7. `optika-egymodusu` bands (optional): widen to the standard bands. Conversion f = c / lambda.
   - XGS-PON down 1575–1580 nm: [189740000000000, 190340000000000] Hz
   - XGS-PON up 1260–1280 nm: [234210000000000, 237920000000000] Hz
   - GPON/optional-plan down 1480–1500 nm: [199860000000000, 202570000000000] Hz
   - Replace the matching nominal ranges only if the owner wants bands to mean allowed windows rather than nominal channels.
8. `ethernet` rate (optional): after `10 Gbit/s rövidebb távon (Cat6, 250 MHz)` add ` (kb. 55 m, zsúfolt kötegben kb. 37 m)`.

## Not verified
- Ethernet: Cat5e 100 MHz, 90 m + 10 m split in ISO/IEC 11801, EN 50174-2 separation, 4x outer diameter bend radius, T568A/B (no source returned; standards are paywalled).
- PoE: the 44-57 V figure is not on the card; it was confirmed only for the PSE-side af range.
- KNX: card band [2000, 20000] Hz; green sheath colour not seen as text; DALI "mains cable allowed" read only via the DALI Alliance guide title, not the text.
- M-Bus: card band [150, 10000] Hz; EN 13757-2 baud table (which rates are mandatory) not read.
- 1-Wire: 4.7 kohm pull-up (AN4255 not retrieved); the 15.4 kbit/s exact figure.
- SRD: 433.05-434.79 MHz and 863-870 MHz current Annex 1 limits, duty cycles, Z-Wave EU 868.42 MHz, Zigbee/BLE figures, 2400-2483.5 MHz, DECT 1880-1900 MHz.
- RFID 125 kHz / 13.56 MHz standards, IR 940 nm and 36-40 kHz carrier, analog/telephone/50 Hz cards, koax-tv 47-862 MHz, DOCSIS.
- Fibre: G.652/G.657, SC/APC green, OM3/OM4 850 nm, GPON 2.5/1.25 Gbit/s, G.984.2 upstream window (1290-1330 nm).
- HDMI: HDBaseT 100 m, "IEEE 1911", HDMI band [25 MHz, 6 GHz] on the card; hdmi.org not read.
- Hungary: DVB-T 470-694 MHz lower limit and the current network list; exact 700/800/900/1800 MHz sub-blocks; one third-party database conflicts on 2600 MHz holders.
- Standards (G.993.2 profile tables, ECC/DEC/(04)08 current status, EU 5 GHz decision) were reached only through summaries and tables of contents, not the normative text. The 5 GHz source is from 2004 and may be superseded.
