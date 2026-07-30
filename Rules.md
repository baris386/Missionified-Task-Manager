## 1. Komponentlər və Interfeys Quruluşu

### 1.1 Üst Panel / Konfiqurasiya
- **Xatırlatma (Reminder):** Tapşırıqlar üçün xatırlatmanın təyin edilməsi.
- **Təkrar Əlavə Etmə:** Tapşırığın təkrar olunma tezliyinin (dövri tapşırıqlar) tənzimlənməsi.

### 1.2 Tapşırıq Kartı (Task Card)
Eskizdə göstərilən tapşırıq kartının tərkibi:
- **Başlıq (Title):** Tapşırığın qısa adı.
- **Detallar (Details):** Tapşırıq haqqında ətraflı məlumat və ya təsvir.
- **Xal Sistemi (+ / -):** Tapşırığın yerinə yetirilməsinə və ya təxirə salınmasına görə müsbət (+) və mənfi (-) xalların hesablanması.
- **İdarəetmə Düymələri (Actions):**
  - **Edit:** Tapşırığı redaktə etmək.
  - **Sil:** Tapşırığı silmək.

---

## 2. Funksional Tələblər

### 2.1 Tapşırıq Yaradılması və Redaktəsi
- İstifadəçi yeni tapşırıq yaradarkən **Başlıq** və **Detallar** daxil edir.
- **Xatırlatma** vaxtı təyin oluna bilər.
- Tapşırığın **Təkrar əlavə edilməsi** (günlük, həftəlik və s.) aktivləşdirilə bilər.

### 2.2 Xallama Mexanizmi (Gamification / Point System)
- Hər bir tapşırıq müəyyən xal dəyərinə malikdir.
- Tapşırıq uğurla tamamlandıqda istifadəçiyə müsbət xal (**+**) əlavə olunur.
- Tapşırıq vaxtında edilmədikdə və ya ləğv edildikdə mənfi xal (**-**) çıxılır.

### 2.3 Redaktə və Silmə
- İstənilən tapşırıq kartı üzərində **Edit** düyməsi vasitəsilə dəyişikliklər etmək mümkündür.
- **Sil** düyməsi tapşırığı sistemdən tamamilə təmizləyir.

---

## 3. Data Modeli (İllüstrativ JSON)

```json
{
  "id": "task-001",
  "title": "Başlıq",
  "details": "Detallar burada qeyd olunur",
  "reminder": true,
  "reminder_time": "2026-08-01T10:00:00",
  "repeat": false,
  "points": {
    "positive": 10,
    "negative": 5
  },
  "status": "pending"
}
```