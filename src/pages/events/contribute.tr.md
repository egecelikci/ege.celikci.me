---
title: Etkinliklere Nasıl Katkıda Bulunulur
id: contribute-events
lang: tr
url: /events/contribute/
layout: layouts/page.vto
navigation:
  parent: /events/
  parentTitle: İzmir’deki etkinlikler
templateEngine: [vto, md]
---

Eğer bir etkinlik [İzmir’deki etkinlikler](/events) sayfasında mevcut değilse, bunun sebebi etkinliğin açık kaynaklı [MusicBrainz](https://musicbrainz.org) veritabanına henüz eklenmemiş olmasıdır.

Bu sayfanın arkasındaki sistem, İzmir’deki etkinlikleri MusicBrainz üzerinden otomatik olarak çekerek listeler. Yani küresel müzik veritabanına yapacağınız her katkı, kısa süre içinde burada da görünür hale gelir.

Bir etkinliğin [events](/events) sayfasında görüntülenmesini istiyor ve bu konuda neler yapabileceğinizi merak ediyorsanız; süreç hakkında genel bir fikir edinip kendi kendinize katkıda bulunabilmeniz için olabildiğince detaylandırılmış ama aynı zamanda takip etmesi kolay bir rehber hazırlamak istedim.

{{ set calloutInfo = "Süreç hakkında daha fazla İngilizce detaya ve resmî dokümantasyona ulaşmak için [How to Add an Event to MusicBrainz](https://musicbrainz.org/doc/How_to_Add_an_Event) sayfasına göz atabilirsiniz." |> md }}
{{ comp base.Callout { variant: "info", content: calloutInfo } /}}

## İçindekiler

---

## MusicBrainz’e Etkinlik Ekleme

{{
await comp.ui.Video({
id: "t_I7n49ZhOg",
title: "How to Add Events to MusicBrainz",
credits: [{
name: "MetaBrainz",
role: "Author",
url: "https://metabrainz.org"
}]
})
}}

### 1. Bir Hesap Açın

- [MusicBrainz Kayıt Sayfası](https://musicbrainz.org/register)na gidin.
- Kendinize bir kullanıcı adı ve parola belirleyip e-posta adresinizi doğrulayın.

### 2. Etkinlik Ekleme Sayfasına Gidin

Giriş yaptıktan sonra, üst menüdeki **Editing** seçeneğinin altından **Add Event** butonuna tıklayabilir veya doğrudan [musicbrainz.org/event/create](https://musicbrainz.org/event/create) adresine gidebilirsiniz.

![MusicBrainz Düzenleme Menüsü](/assets/images/docs/events/58d8956c-06db-4361-b3fc-6a38d4dcd38c.png)

### 3. Formu Doldurun (Temel Alanlar)

Seçeneğe tıkladığınızda karşınıza bir form çıkacaktır. İlk olarak etkinliğin temel bilgilerini giriyoruz:

![MusicBrainz Düzenleme Menüsü](/assets/images/docs/events/20339d46-0b08-48db-9a6d-70702901a24e.png)

MusicBrainz, veritabanının kalitesini korumak için belirli standartlara sahiptir:

- **Name**: Etkinliğin adı. Eğer etkinliğin resmi bir adı yoksa, bu alanı "Sanatçı A & Sanatçı B at Mekan C" veya "Sanatçı A, Sanatçı B, Sanatçı C at Mekan D" formatında _manuel olarak_ yazmalısınız. Örneğin:
  - İsimli etkinlikler: [Byzantion Show Series #58](https://musicbrainz.org/event/8a5b924c-32c7-46f3-8af8-e2dd6cd936c3) ve [infuse_archonGrid](https://musicbrainz.org/event/3a488e0b-ee8b-4599-9ad8-410f318ae32a)
  - İsimsiz etkinlikler: [Rektal Tuşe, Primitive Call & Taarruz at NØMADS-36](https://musicbrainz.org/event/12f8f8ee-12f4-4a3a-8dc9-1a06da788bb4)
- **Type**: Etkinliğin türünü belirtir. **Concert** (Konser) dışında bir etkinlik tipine nadiren ihtiyaç duyulur. (Her etkinlik bir konser değildir, farklı bir konsept varsa MusicBrainz'deki uygun türü seçebilirsiniz).
- **Date period**: Etkinliğin başladığı ve bittiği tarihler ile başlangıç saati. Kapı açılış veya konser başlangıç saatinden hangisi size daha mantıklı geliyorsa onu tercih edebilirsiniz.

{{ set calloutHeadsUp = "Formu doldururken doğruluğundan emin olmadığınız veya bilmediğiniz verileri zorlamak yerine lütfen **boş bırakın**. Hatalı veri girmektense eksik veri bırakmak veritabanının sağlığı açısından çok daha iyidir." |> md }}
{{ comp base.Callout { variant: "danger", content: calloutHeadsUp } /}}

---

### 4. İlişkiler (Relationships) ve Etkinlik Ekibi

Formun **Relationships** bölümü; performansçıları, arka plan ekibini, mekanları ve organizatörleri etkinlikle _ilişkilendirdiğiniz_ (bağladığınız) yerdir.

Bu kısım oldukça önemlidir. Buraya girdiğiniz veriler sayesinde İzmir'deki etkinlikler sayfasında haritalar, yol tarifleri ve özel afiş/tasarım jenerikleri otomatik olarak oluşturulur.

![İlişki Ekleme Bölümü](/assets/images/docs/events/8be0c907-526b-4234-a7d5-7f52197e6d3f.png)

{{ set calloutWarning = 'Hiçbir ilişkisi (sanatçı veya mekan bağlantısı) olmayan bir etkinlik, “boş” olduğu gerekçesiyle MusicBrainz tarafından bir süre sonra silinir.' |> md }}
{{ comp base.Callout { variant: "warning", content: calloutWarning } /}}

#### Sanatçılar ve Görevliler (Artist-Event)

**Add relationship** butonuna tıkladığınızda ilişkinin türünü (Related type) **Artist** seçerek etkinliğe dahil olan herkesi ekleyebilirsiniz.

![Artist İlişkisi Ekleme Bölümü](/assets/images/docs/events/2a8475bd-4bcd-4d4c-b0bb-ae0928ab6d35.png)

Sahnedeki müzisyenlerin ötesinde, arka plan ekibini de eklemek müzik topluluğuna emek verenleri onurlandırmak adına harika bir arşivcilik adımıdır:

- **Sahnedekiler:** Sahnedeki isimleri **main performer** (ana sanatçı), **support act** (alt grup), **guest performer**, **host**, **supporting DJ**, **VJ** gibi rollerle ekleyebilirsiniz. Bu isimler İzmir'deki etkinlikler sayfasında doğrudan listelenir.
- **Görsel / İşitsel Emekçiler (Non-performing):** Etkinliğin afişini çizen veya tasarlayan kişileri **artwork**, **graphic design** veya **illustration** rolüyle eklerseniz, bu isimler etkinlik detay sayfasında _Afiş (Poster) Kredisi_ olarak listelenir. Ses/video prodüksiyonunu yapan kişileri ise **engineer** veya **design** rolüyle ekleyebilirsiniz.

#### Organizatörler / Kolektifler (Label-Event)

Bir etkinliği düzenleyen bir organizasyon, plak şirketi, zine veya kolektif varsa bunu ilişki türünü **Label** ve alt türünü **presented** (sundu/düzenledi) olarak seçerek ekleyebilirsiniz.

![Label İlişkisi Ekleme Bölümü](/assets/images/docs/events/134c5216-0d06-45dc-875a-111d8aaadca1.png)

#### Mekan ve Harita Entegrasyonu (Event-Place)

İzmir'deki etkinlikler sayfasında yer alan etkileşimli haritanın ve "Yol Tarifi" butonlarının çalışabilmesi için etkinliğin bir mekana (Venue) bağlı olması şarttır. Mekanı eklemek için varlık türünü **Place**, ilişki türünü ise **held at** (burada düzenlendi) olarak seçmelisiniz.

![Place İlişkisi Ekleme Bölümü](/assets/images/docs/events/d8a8a917-8137-47f4-823d-51c6eeca6023.png)

**Mekan sistemde yoksa:**
Eğer aradığınız mekan MusicBrainz'de henüz kayıtlı değilse, mekan arama kutusundan yenisini oluşturabilirsiniz. Açılan **Add a new place** penceresinde şunlara dikkat edin:

![Mekan Ekleme Formu](/assets/images/docs/events/d80bae08-4f23-4d8e-b300-636685828d57.png)

- **Name**: Mekanın tam adı.
- **Type**: Genellikle **Venue** (Mekan) seçilmelidir.
- **Address**: Mekanın açık adresi.
- **Area**: Konserin yapıldığı şehri buraya girin (Örn: İzmir).
- **Coordinates**: Harita koordinatları (enlem ve boylam, Örneğin: `38.42250, 27.13111`).

---

### 5. Dış Bağlantılar ve Sosyal Medya (External links)

Aynı form üzerinde, **Relationships** bölümünün hemen altında **External links** adında ayrı bir bölüm göreceksiniz. Burası etkinliklerin sosyal medya, bilet ve resmi sayfalarını sisteme tanımladığımız yerdir.

![Dış Bağlantılar Formu](/assets/images/docs/events/153618f9-d6f2-468d-b80c-8bd56b6428c6.png)

- **Etkinlik için**: Etkinliğin bilet satış sayfasını, Facebook etkinlik bağlantısını, Last.fm etkinlik sayfasını veya organizatör sitesinin URL'sini kopyalayıp buradaki **Add link** kutusuna yapıştırabilirsiniz. Bu linkler _İzmir'deki etkinlikler_ sayfasında özel butonlara (Bilet Al, etkinlik sayfasını ziyaret et vb.) dönüşür.
- **Sanatçı ve profil sayfaları için**: Bir sanatçıyı, mekanı veya organizatörü (Label) kendi profil sayfalarından düzenlerken de onların **Instagram** veya **official homepages** bağlantılarını eklediğinizden emin olun. İzmir'deki etkinlikler sayfası bu verileri de otomatik çeker ve mümkün olduğunca listelemeye çalışır.

{{ set calloutTip = `Bu tarz katkılar sanatçıların bağlantılarını tek bir sayfada sergilemesi için bir altyapı görevi görebilir. Örneğin:

- [SPRAY · Achordion](https://achordion.xyz/artist/9c27db9d-890c-4c14-bf43-3d371380a8d4)` |> md }}
  {{ comp base.Callout { variant: "info", content: calloutTip } /}}

---

### 6. Düzenleme Notları (Edit Note) ve Kaydetme

Sayfanın en altında **Edit note** bölümü bulunur. Değişiklikleri kaydetmeden önce, bilgiyi nereden aldığınızı (Instagram gönderi bağlantısı, bilet satış linki, etkinlik afişi vb.) belirten kısa bir not veya URL eklemeniz çok önemlidir. Bu, diğer MusicBrainz editörlerinin katkınızı doğrulamasını ve onaylamasını sağlar.

![Düzenleme Notu Alanı](/assets/images/docs/events/e33ea3f4-edf2-4b1f-a4f0-41e794adc198.png)

Her şey tamamlandığında sayfanın en altındaki **Enter edit** butonuna tıklayarak etkinliği ekleyebilirsiniz!

![“Enter edit” Butonu](/assets/images/docs/events/6ee2c777-6bf9-4e18-83d1-3a1fa9bab8b9.png)

{{ set calloutExamples = "Formu doldururken ilişkileri veya alanları nasıl yapılandıracağınızdan tam emin olamazsanız, [MusicBrainz İzmir Etkinlik Listesi](https://musicbrainz.org/area/f6a9a62a-23b1-4f2e-b2f0-ac36f113f0b5/events) sayfasına göz atabilirsiniz. Orada önceden açılmış, onaylanmış ve başarıyla listelenen onlarca etkinlik örneği mevcut olduğundan, burayı kendinize pratik bir şablon rehber olarak kullanabilirsiniz." |> md }}
{{ comp base.Callout { variant: "info", content: calloutExamples, icon: "lightbulb" } /}}

---

## Harmony ile Otomatik Veri Aktarımı

Eğer sevdiğiniz sanatçıların çeşitli servisler (Spotify, Bandcamp, Apple Music, Tidal vb.) üzerindeki profillerini ve albümlerini MusicBrainz'e kolayca, hatta tek tıkla girmek istiyorsanız, [Harmony](https://harmony.pulsewidth.org.uk/) aracını kullanabilirsiniz. Harmony, albüm ve sanatçı verilerini saniyeler içinde MusicBrainz'e aktarmanızı sağlayan harika bir açık kaynaklı projedir.

---

## Sahneyi ve Topluluğu Desteklemenin Diğer Yolları

MusicBrainz'e veri girmek, İzmir'deki müzik hafızasını arşivlemek için harika bir adımdır. Ancak yerel sahneyi, sanatçıları ve bu bağımsız takvimi desteklemenin tek yolu bu değil. Dijital dünyada veya fiziksel olarak yapabileceğiniz diğer katkılar da topluluk için hayati önem taşır:

- **Bu sayfayı paylaşın**: İzmir'deki etkinlikler takvimini arkadaşlarınızla veya sosyal medyanızda paylaşarak daha fazla insanın yerel konserlerden haberdar olmasını sağlayabilirsiniz. Takvimin yaygınlaşması, bağımsız etkinliklerin daha çok dinleyiciye ulaşması demektir.
- **Katkı sağlanmasına vesile olun**: Çevrenizde arşivcilik yapmayı seven, yerel sahneyi yakından takip eden veya MusicBrainz gibi açık kaynaklı projelere zaman ayırabilecek arkadaşlarınızı bu rehberden haberdar edebilirsiniz.
- **Konserlere gidin**: Yerel ve bağımsız sahneye verilebilecek en büyük ve en doğrudan destek, o kapıdan içeri girmek, bilet almak ve performansı canlı izlemektir.
- **Sanatçılardan merch alın**: Sevdiğiniz bağımsız grupların ve müzisyenlerin CD, tişört, kaset, plak, fanzin veya sticker gibi ürünlerini (merch) satın alarak onlara en doğrudan finansal desteği sağlayabilirsiniz.

---

## Yardıma mı İhtiyacınız Var?

Eğer süreç kafanızı karıştırıyorsa veya bir etkinlik hakkında bilginiz olup kendiniz eklemekle uğraşmak istemiyorsanız [iletişim sayfasındaki](/contact) bilgilerden bana ulaşabilirsiniz.
