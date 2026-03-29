# jhcisdb Database Summary

**Connected:** 2026-03-29 08:58 GMT+7  
**Host:** localhost:3333  
**Total Tables:** 499

---

## 📦 Tables Relevant for Inventory & Procurement

### Drug/Medicine Tables

| Table | Rows | Description |
|-------|------|-------------|
| `cdrug` | 6,415 | Main drug catalog |
| `cdrug_big_to_cdrug` | 6,403 | Drug mapping table |
| `cdrug_copy1` | 8,296 | Drug backup/copy |
| `cdrugremain` | 1,301 | Remaining drug stock |
| `cdrugunitsell` | 35 | Drug unit selling info |
| `drug_tes` | 6,405 | Drug test data |
| `drug_to_draw` | 204 | Drug withdrawal records |
| `drug_nayai` | 714 | Pharmacy drug data |

### Drug Store/Stock Tables

| Table | Rows | Description |
|-------|------|-------------|
| `drugstorereceive` | 314 | Drug store receiving |
| `drugstorereceivedetail` | 9,459 | Drug receiving details |
| `drugstoretoloan` | 421 | Drug store loan records |
| `drugrepositoryout` | 0 | Drug repository outbound |
| `drugrepositoryoutdetail` | 0 | Outbound details |
| `drugrepositorytaken` | 0 | Drug repository taken |
| `drugrepositorytakendetail` | 0 | Taken details |

### Drug Usage Tables

| Table | Rows | Description |
|-------|------|-------------|
| `visitdrug` | 627,705 | Drug prescriptions per visit |
| `visitdrugdental` | 10,529 | Dental drug prescriptions |
| `sysdrugdose` | 2,262 | Drug dosage standards |
| `sysdrugformula` | 60 | Drug formula standards |
| `sysdrugformuladetail` | 177 | Formula details |
| `sysdrugformuladetaildiag` | 130 | Formula diagnosis mapping |

### Mapping/Reference Tables

| Table | Rows | Description |
|-------|------|-------------|
| `cdiseaseconflictdrug` | 685 | Disease-drug conflicts |
| `cdrugallergysymtom` | 39 | Drug allergy symptoms |
| `cdrugmaptype` | 4 | Drug map types |
| `cresondrug_outacc` | 7 | Drug outpatient reasons |

---

## 🏥 Other Notable Tables

### High-Volume Transaction Tables

| Table | Rows |
|-------|------|
| `visit` | 359,085 |
| `visit_copy` | 138,003 |
| `visitdiag` | 605,123 |
| `cdisease` | 37,998 |
| `chospital` | 15,359 |

### Patient Tables

| Table | Rows |
|-------|------|
| `person` | 8,334 |
| `personaddresscontact` | 5,737 |
| `persongrow` | 24,958 |
| `personstudent` | 1,191 |
| `personchronic` | 697 |

---

## 🔍 Table Prefix Groups

| Prefix | Count | Topic |
|--------|-------|-------|
| `provis_` | 12 | Provisional/Temporary data |
| `replicate_` | 9 | Data replication logs |
| `j2_` | 7 | JHCIS version 2 imports |
| `ncd_` | 6 | Non-Communicable Diseases |
| `std18_` | 6 | Standard 18 export validation |
| `tmp_` | 4+ | Various temporary tables |
| `visit` | 50+ | Visit-related transactions |
| `c` | 100+ | Configuration/lookup tables |

---

## 💡 Recommendations for Inventory Module

1. **Start with `cdrug`** - Main drug master data (6,415 items)
2. **Track stock with `drugstorereceive` + `drugstorereceivedetail`** - Receiving transactions
3. **Monitor usage via `visitdrug`** - 627K prescription records
4. **Check `cdrugremain`** - Current remaining stock (1,301 items)

---

*Full schema analysis saved to: `../db_schema_analysis.json`*
