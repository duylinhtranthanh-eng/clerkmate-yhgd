/**
 * Demo case 2 — an elderly multimorbid patient.
 *
 * Chosen to contrast with the knee-osteoarthritis case: it exercises the parts
 * of ClerkMate the first case leaves idle — several active comorbidities with
 * different control levels, polypharmacy, a high falls risk, a positive
 * depression screen escalating from PHQ-2 to PHQ-9, and a family life cycle
 * stage that Duvall's eight stages have no place for.
 *
 * Fictional throughout.
 */

import type { CaseRecord, LearnerLevel } from '../../types/case'
import { createEmptyCase, createFragment } from '../../types/factory'
import { uid } from '../../utils/id'
import { computeBmi, todayIso } from '../../utils/format'
import { EXAM_NORMAL_BY_ID } from '../clinical'

export function buildElderlyMultimorbidCase(level: LearnerLevel = 'SDH'): CaseRecord {
  const c = createEmptyCase(level, 'Ca mẫu 2')

  c.patient = {
    ...c.patient,
    name: 'Ông T. (giả lập)',
    sex: 'male',
    ageYears: 74,
    dateOfBirth: '1952',
    occupation: 'Hưu trí, trước là thợ hàn',
    education: 'Trung học phổ thông',
    ethnicity: 'Kinh',
    religion: 'Không',
    maritalStatus: 'Vợ mất năm 2023',
    address: 'Xã A, huyện B',
    insurance: 'Có bảo hiểm y tế',
  }

  c.visit = {
    ...c.visit,
    date: todayIso(),
    setting: 'Trạm y tế xã',
    encounterType: 'Tái khám',
    reasonForEncounter: 'Tái khám đái tháo đường và tăng huyết áp, kèm hai lần té ngã trong ba tháng.',
    accompaniedBy: 'Con trai',
  }

  c.quickNotes = [
    createFragment('text', 'BN nam 74t, hưu trí, sống một mình. Tái khám ĐTĐ + THA. Té 2 lần 3 tháng, lần sau bầm hông. ' +
        'Đang uống metformin 850mg 2 lần/ngày, amlodipine 5mg, gliclazide 30mg, aspirin 81mg, atorvastatin 20mg. ' +
        'HA 152/88, M 76, NT 18, CN 58kg, CC 165cm. Mẹ ĐTĐ, cha NMCT. ' +
        'Không hút thuốc 10 năm nay, trước hút 30 gói-năm. Buồn, ít muốn làm gì từ khi vợ mất.', ['patient', 'history', 'personalHistory', 'examination', 'medications', 'familyHistory']),
  ]

  c.history = {
    chiefComplaint: 'Té ngã hai lần trong ba tháng',
    duration: '3 tháng',
    hpi:
      'Bệnh nhân đái tháo đường típ 2 12 năm và tăng huyết áp 15 năm, theo dõi tại trạm y tế. ' +
      'Ba tháng nay té hai lần: lần đầu khi đứng lên từ giường buổi sáng, choáng nhẹ rồi ngồi sụp xuống, không chấn thương. ' +
      'Lần thứ hai cách đây hai tuần khi đi ra nhà vệ sinh ban đêm, trượt trên nền ướt, bầm tím vùng hông phải, không gãy xương. ' +
      'Bệnh nhân kể hay choáng khi đứng dậy nhanh, hai chân yếu hơn trước, đi lại phải bám tường. ' +
      'Từ khi vợ mất hơn hai năm trước, ăn uống thất thường, có hôm bỏ bữa nên đôi lúc vã mồ hôi run tay buổi chiều.',
    socrates: {
      site: 'Không đau khu trú; triệu chứng chính là choáng và yếu hai chân',
      onset: 'Từ từ trong 6 tháng, nặng hơn 3 tháng nay',
      character: 'Choáng kiểu xây xẩm khi đổi tư thế',
      radiation: 'Không',
      associations: 'Yếu hai chân, đôi lúc vã mồ hôi run tay buổi chiều',
      timeCourse: 'Từng cơn ngắn khi đứng lên, hết sau khi ngồi nghỉ',
      exacerbatingRelieving: 'Tăng khi đứng dậy nhanh và khi bỏ bữa; giảm khi ngồi nghỉ',
      severity: 'Đủ để phải bám tường khi đi',
    },
    redFlags: {
      present: ['Tê yếu chi tiến triển'],
      absent: ['Sụt cân không chủ ý', 'Dấu thần kinh khu trú', 'Đau ngực khi gắng sức', 'Ngất hoặc gần ngất'],
      note:
        'Yếu hai chân tiến triển cần phân biệt bệnh lý thần kinh ngoại biên do đái tháo đường với bệnh lý tủy — ' +
        'không có rối loạn cơ vòng, không mất cảm giác theo khoanh tủy.',
    },
    ice: {
      ideas: 'Bệnh nhân nghĩ do "tuổi già yếu chân", không nghĩ liên quan đến thuốc.',
      concerns: 'Lo nếu té nặng phải nằm một chỗ thì không ai chăm, sợ thành gánh nặng cho con.',
      expectations: 'Mong được cho thuốc bổ cho chân khỏe và không phải vào bệnh viện.',
    },
    systemsReview:
      'Tim mạch: không đau ngực, không khó thở khi gắng sức nhẹ. Hô hấp: ho khan buổi sáng, không khó thở. ' +
      'Tiêu hóa: ăn kém, không đau bụng. Tiết niệu: tiểu đêm 3 lần. Thần kinh: tê rát hai bàn chân về đêm.',
  }

  c.personalHistory.pastMedical = [
    { id: uid('pm'), system: 'Nội tiết', label: 'Đái tháo đường típ 2', since: '12 năm', status: 'Đang điều trị', note: 'HbA1c gần nhất 8,4%' },
    { id: uid('pm'), system: 'Tim mạch', label: 'Tăng huyết áp', since: '15 năm', status: 'Đang điều trị', note: '' },
    { id: uid('pm'), system: 'Thận - tiết niệu', label: 'Bệnh thận mạn', since: '3 năm', status: 'Theo dõi', note: 'eGFR 48 mL/phút/1,73 m²' },
    { id: uid('pm'), system: 'Hô hấp', label: 'Bệnh phổi tắc nghẽn mạn tính', since: '5 năm', status: 'Ổn định', note: 'Tiền căn hút thuốc 30 gói-năm' },
    { id: uid('pm'), system: 'Nội tiết', label: 'Rối loạn lipid máu', since: '8 năm', status: 'Đang điều trị', note: '' },
  ]
  c.personalHistory.pastSurgical = [
    { id: uid('ps'), system: 'Ngoại khoa', label: 'Mổ thay thủy tinh thể mắt phải', since: '2021', status: '', note: '' },
  ]
  c.personalHistory.allergies = [
    { id: uid('al'), agent: 'Captopril', reaction: 'Ho khan nhiều', severity: 'Nhẹ, phải ngưng thuốc' },
  ]
  c.personalHistory.note = 'Không truyền máu. Không tiền căn lao.'

  c.lifestyle = {
    smoking: { status: 'Đã bỏ thuốc lá 10 năm', detail: 'Trước hút 30 gói-năm' },
    alcohol: { status: 'Không uống rượu bia', detail: '' },
    physicalActivity: 'Hầu như không ra khỏi nhà từ khi té lần hai',
    diet: 'Ăn thất thường, có hôm bỏ bữa; tự nấu một mình',
    sleep: 'Ngủ 4–5 giờ, thức giấc nhiều lần, tiểu đêm 3 lần',
    substanceUse: 'Không',
    stress: 'Cô đơn từ khi vợ mất năm 2023',
    occupationalExposure: 'Khói hàn kim loại trong 25 năm làm thợ hàn',
  }

  c.familyHistory.entries = [
    { id: uid('fh'), condition: 'Đái tháo đường', relatives: 'Mẹ', note: '' },
    { id: uid('fh'), condition: 'Nhồi máu cơ tim', relatives: 'Cha', note: 'Mất ở tuổi 68' },
  ]

  c.familyMedicineAssessment = {
    familyType: 'Sống một mình',
    familyLifeCycleStage: '9. Sống một mình sau ly hôn hoặc mất vợ/chồng',
    familyLifeCycleNote:
      'Bệnh nhân mất vợ năm 2023, hai con đã lập gia đình và sống ở tỉnh khác. ' +
      'Vai trò chăm sóc trước đây do vợ đảm nhận nay không có người thay thế — đây là gốc của việc bỏ bữa, ' +
      'quên thuốc và chậm phát hiện các lần té.',
    apgar: {
      adaptation: 1,
      partnership: 1,
      growth: 1,
      affection: 2,
      resolve: 0,
      note: 'Tổng 5/10 — rối loạn chức năng gia đình mức nhẹ, chủ yếu do khoảng cách địa lý và thiếu thời gian bên nhau.',
    },
    screem: {
      social: {
        resources: 'Hội người cao tuổi xã, láng giềng để ý giúp',
        pathology: 'Sống một mình, ít ra khỏi nhà sau khi té; không ai phát hiện nếu té ban đêm',
      },
      cultural: { resources: 'Con coi trọng phụng dưỡng cha', pathology: 'Bệnh nhân ngại làm phiền con' },
      religious: { resources: '', pathology: 'Không sinh hoạt tôn giáo, thiếu nguồn nâng đỡ tinh thần' },
      economic: {
        resources: 'Lương hưu, có bảo hiểm y tế',
        pathology: 'Không đủ chi trả người giúp việc hoặc chăm sóc tại nhà',
      },
      educational: {
        resources: 'Đọc viết tốt, hiểu hướng dẫn',
        pathology: 'Không biết hạ đường huyết là gì nên không xử trí đúng khi vã mồ hôi run tay',
      },
      medical: {
        resources: 'Trạm y tế cách nhà 800 m, quen bác sĩ',
        pathology: 'Chưa từng được đánh giá nguy cơ té ngã hay rà soát lại toa thuốc',
      },
    },
    homeEnvironment:
      'Nhà cấp 4, nhà vệ sinh ở ngoài sân, đường ra không có đèn và nền xi măng đọng nước khi mưa. ' +
      'Không có tay vịn, giường cao. Đây là nơi xảy ra lần té thứ hai.',
    continuityNote:
      'Bác sĩ trạm y tế theo dõi mỗi 4 tuần. Đề xuất thêm: một lần thăm nhà để can thiệp an toàn, ' +
      'và thống nhất với con trai một người liên lạc chính để nhắc thuốc qua điện thoại.',
  }

  c.examination.generalAppearance =
    'Tỉnh, tiếp xúc tốt nhưng khí sắc trầm, ít chủ động nói. Thể trạng gầy, da khô. ' +
    'Đi lại chậm, bước ngắn, phải bám vào tường. Bầm tím vàng vùng hông phải đang tiêu.'
  c.examination.vitals = {
    temperatureC: '36.8',
    pulse: '76',
    respiratoryRate: '18',
    systolic: '152',
    diastolic: '88',
    spo2: '95',
    bloodGlucose: '',
    heightCm: '165',
    weightKg: '58',
    waistCm: '86',
    bmi: computeBmi('165', '58'),
  }
  const setSystem = (id: string, status: 'normal' | 'abnormal', findings?: string) => {
    const sys = c.examination.systems.find((x) => x.id === id)
    if (sys) {
      sys.status = status
      sys.findings = findings ?? EXAM_NORMAL_BY_ID[id] ?? ''
    }
  }
  setSystem('abdomen', 'normal')
  setSystem('ent', 'normal')
  setSystem('genitourinary', 'normal')
  setSystem('cardiovascular', 'abnormal',
    'Tim đều, T1 T2 rõ, không âm thổi. Huyết áp nằm 152/88, sau khi đứng 1 phút còn 128/76 kèm choáng — ' +
    'hạ huyết áp thế đứng.')
  setSystem('respiratory', 'abnormal',
    'Lồng ngực hình thùng, rì rào phế nang giảm hai đáy, ran rít nhẹ cuối thở ra hai bên.')
  setSystem('neurological', 'abnormal',
    'Giảm cảm giác rung và cảm giác sờ theo kiểu bao tay bao chân đến 1/3 dưới cẳng chân hai bên. ' +
    'Phản xạ gân gót giảm hai bên. Sức cơ gốc chi 4/5. Không dấu Babinski, không rối loạn cơ vòng.')
  setSystem('musculoskeletal', 'abnormal',
    'Teo cơ tứ đầu đùi hai bên. Đứng lên từ ghế không dùng tay được nhưng chậm. Không biến dạng khớp.')
  setSystem('skin', 'abnormal', 'Da khô, nứt gót chân hai bên. Không loét bàn chân. Bầm tím vùng hông phải.')
  setSystem('mental', 'abnormal', 'Khí sắc trầm, giảm hứng thú. Không ý tưởng tự sát khi hỏi trực tiếp.')

  c.investigations.proposed = [
    { id: uid('inv'), name: 'HbA1c' },
    { id: uid('inv'), name: 'Creatinin — eGFR' },
    { id: uid('inv'), name: 'Ion đồ' },
    { id: uid('inv'), name: 'Công thức máu' },
    { id: uid('inv'), name: 'Vitamin D 25-OH' },
    { id: uid('inv'), name: 'Điện tâm đồ' },
  ]
  c.investigations.results = [
    { id: uid('res'), name: 'HbA1c', date: todayIso(), value: '8,4', unit: '%', flag: 'abnormal', interpretation: 'Chưa đạt đích, nhưng đích cần nới rộng ở người cao tuổi có nguy cơ hạ đường huyết', attachmentId: null },
    { id: uid('res'), name: 'Creatinin', date: todayIso(), value: '1,4', unit: 'mg/dL', flag: 'abnormal', interpretation: 'eGFR 48 mL/phút/1,73 m² — bệnh thận mạn giai đoạn 3a', attachmentId: null },
    { id: uid('res'), name: 'Kali máu', date: todayIso(), value: '3,4', unit: 'mmol/L', flag: 'abnormal', interpretation: 'Hạ kali nhẹ', attachmentId: null },
    { id: uid('res'), name: 'Hemoglobin', date: todayIso(), value: '11,8', unit: 'g/dL', flag: 'abnormal', interpretation: 'Thiếu máu nhẹ', attachmentId: null },
  ]
  c.investigations.summary =
    'HbA1c 8,4%. Creatinin 1,4 mg/dL, eGFR 48 mL/phút/1,73 m². Kali 3,4 mmol/L. Hemoglobin 11,8 g/dL. ' +
    'Điện tâm đồ nhịp xoang, không rung nhĩ, không rối loạn dẫn truyền.'

  c.investigations.interpretation = {
    abnormal:
      'Bốn kết quả bất thường: HbA1c 8,4% (cao), eGFR 48 (giảm, giai đoạn 3a), kali 3,4 mmol/L (giảm nhẹ), ' +
      'Hemoglobin 11,8 g/dL (giảm nhẹ). Ba trong bốn cái này đều có thể góp phần gây choáng và té ngã.',
    supportsDiagnosis:
      'Không có kết quả nào giải thích được một mình các lần té ngã — và điều đó chính là phát hiện quan trọng: ' +
      'té ngã ở đây là do nhiều yếu tố cộng lại. Hạ kali và thiếu máu nhẹ đều làm nặng thêm tình trạng choáng ' +
      'khi đổi tư thế đã ghi nhận được khi khám. eGFR 48 giải thích tại sao thuốc dễ tích lũy. ' +
      'Điện tâm đồ nhịp xoang làm ít nghĩ rối loạn nhịp là nguyên nhân, nên không cần Holter ở bước này.',
    inconsistencies:
      'HbA1c 8,4% gợi ý đường huyết cao, nhưng bệnh nhân lại có cơn nghi hạ đường huyết buổi chiều. ' +
      'Hai điều này không mâu thuẫn: HbA1c là giá trị trung bình, nó che mất biên độ dao động lớn do bỏ bữa ' +
      'khi đang dùng gliclazide. Cần đo đường huyết mao mạch lúc có triệu chứng chứ không tin vào HbA1c.',
    impactOnPlan:
      'Đổi hẳn hướng xử trí: thay vì tăng thuốc hạ đường huyết theo HbA1c, ngưng gliclazide và nới đích lên ' +
      '7,5–8,0%. eGFR 48 vẫn cho phép giữ metformin nhưng phải theo dõi. Bù kali và tìm nguyên nhân thiếu máu. ' +
      'Không cần thêm cận lâm sàng tim mạch vì điện tâm đồ đã âm tính.',
  }

  const setRisk = (id: string, present: 'yes' | 'no', note = '') => {
    const f = c.riskAssessment.factors.find((x) => x.id === id)
    if (f) {
      f.present = present
      f.note = note
    }
  }
  for (const id of ['em.chestPain', 'em.dyspnoea', 'em.neuroDeficit', 'em.severeHypertension',
    'em.sepsis', 'em.bleeding', 'em.suicidal', 'em.violence']) setRisk(id, 'no')
  setRisk('em.dehydration', 'yes', 'Ăn uống thất thường, có hôm bỏ bữa; da khô')
  setRisk('em.hypoglycaemia', 'yes', 'Vã mồ hôi run tay buổi chiều khi bỏ bữa, đang dùng gliclazide — nghi hạ đường huyết')
  setRisk('em.headTrauma', 'no', 'Hai lần té không va đầu; đang dùng aspirin nên cần dặn kỹ')

  setRisk('bh.smoking', 'no', 'Đã bỏ 10 năm, tiền căn 30 gói-năm')
  setRisk('bh.secondhandSmoke', 'no')
  setRisk('bh.alcohol', 'no')
  setRisk('bh.inactivity', 'yes', 'Gần như không ra khỏi nhà sau lần té thứ hai')
  setRisk('bh.diet', 'yes', 'Bỏ bữa, ăn không đủ chất')
  setRisk('bh.substance', 'no')
  setRisk('bh.sleep', 'yes', 'Ngủ 4–5 giờ, thức giấc nhiều lần; ISI 16 — mất ngủ trung bình')

  setRisk('cm.hypertension', 'yes', '15 năm, HA 152/88 chưa đạt đích, kèm hạ huyết áp thế đứng')
  setRisk('cm.diabetes', 'yes', '12 năm, HbA1c 8,4%, có cơn nghi hạ đường huyết')
  setRisk('cm.dyslipidemia', 'yes', 'Đang dùng atorvastatin')
  setRisk('cm.obesity', 'no', 'BMI 21,3')
  setRisk('cm.centralObesity', 'no', 'Vòng eo 86 cm')
  setRisk('cm.familyCvd', 'yes', 'Cha nhồi máu cơ tim tuổi 68')
  setRisk('cm.ckd', 'yes', 'eGFR 48 — giai đoạn 3a')
  setRisk('cm.atrialFibrillation', 'no', 'Điện tâm đồ nhịp xoang')

  setRisk('ca.colorectal', 'yes', 'Chưa từng tầm soát')
  setRisk('ca.prostate', 'yes', 'Chưa bàn về tầm soát')
  setRisk('ca.lung', 'yes', 'Tiền căn 30 gói-năm, đã bỏ 10 năm — còn trong nhóm cần bàn tầm soát')
  setRisk('ca.liver', 'no')
  setRisk('ca.stomach', 'no')
  setRisk('ca.familyEarly', 'no')

  setRisk('ge.falls', 'yes', 'Té 2 lần trong 3 tháng, lần sau có bầm tím')
  setRisk('ge.homeHazard', 'yes', 'Nhà vệ sinh ngoài sân, không đèn, nền đọng nước, không tay vịn')
  setRisk('ge.polypharmacy', 'yes', 'Đang dùng 5 loại thuốc')
  setRisk('ge.frailty', 'yes', 'Đi chậm, teo cơ tứ đầu đùi, sụt cân nhẹ, ít hoạt động')
  setRisk('ge.sensory', 'yes', 'Đã mổ thủy tinh thể mắt phải, mắt trái còn mờ')
  setRisk('ge.malnutrition', 'yes', 'Ăn thất thường, BMI 21,3 nhưng đang giảm cân')
  setRisk('ge.incontinence', 'no', 'Tiểu đêm 3 lần nhưng tự chủ')
  setRisk('ge.osteoporosis', 'yes', 'Chưa đo mật độ xương; nam cao tuổi gầy, té ngã tái diễn')

  setRisk('cg.memoryComplaint', 'no', 'Con trai không ghi nhận giảm trí nhớ; Mini-Cog 5/5')
  setRisk('cg.dementiaRisk', 'yes', 'Tuổi cao, đái tháo đường, tăng huyết áp, giảm thị lực, cô lập xã hội')
  setRisk('cg.delirium', 'no')
  setRisk('cg.adherence', 'yes', 'Quên thuốc khi bỏ bữa; không có ai nhắc')

  setRisk('ps.depression', 'yes', 'PHQ-9 14 điểm — trầm cảm mức trung bình')
  setRisk('ps.anxiety', 'no', 'GAD-2 1 điểm')
  setRisk('ps.chronicStress', 'yes', 'Cô đơn kéo dài từ khi vợ mất')
  setRisk('ps.grief', 'yes', 'Vợ mất năm 2023, vẫn còn ảnh hưởng rõ đến ăn uống và sinh hoạt')
  setRisk('ps.caregiverBurden', 'no', 'Bệnh nhân không phải người chăm sóc')
  setRisk('ps.illnessBelief', 'yes', 'Cho rằng yếu chân là do tuổi già, không liên quan đến thuốc hay bệnh')

  setRisk('so.domesticViolence', 'no')

  setRisk('en.occupational', 'yes', 'Khói hàn kim loại 25 năm — liên quan bệnh phổi tắc nghẽn')
  setRisk('en.indoorSmoke', 'no', 'Dùng bếp gas')
  setRisk('en.housing', 'yes', 'Nhà vệ sinh ngoài sân, thiếu ánh sáng, nền trơn')
  setRisk('en.waterSanitation', 'no')

  c.riskAssessment.recall = {
    emergency: {
      text: '- hạ đường huyết\n- té ngã có chấn thương đầu\n- nhiễm trùng',
      revealedAt: new Date().toISOString(),
    },
    geriatric: {
      text: '- té ngã\n- dùng nhiều thuốc\n- suy dinh dưỡng\n- giảm thị lực',
      revealedAt: new Date().toISOString(),
    },
    psychological: {
      text: '- trầm cảm sau khi vợ mất\n- cô đơn',
      revealedAt: new Date().toISOString(),
    },
  }

  c.riskAssessment.falls = {
    fellPastYear: 'yes',
    fallCount: '2',
    injured: 'yes',
    feelsUnsteady: 'yes',
    worriesAboutFalling: 'yes',
    timedUpAndGoSeconds: '15.5',
    chairStandCount: '6',
    note:
      'Nguyên nhân đa yếu tố: hạ huyết áp thế đứng do thuốc, bệnh lý thần kinh ngoại biên do đái tháo đường, ' +
      'teo cơ tứ đầu đùi, giảm thị lực, và môi trường nhà ở không an toàn.',
  }

  c.riskAssessment.cvd = {
    inputs: { age: '74', sex: 'Nam', smoking: 'Đã bỏ 10 năm', sbp: '152', diabetes: 'Có', cholesterol: '4,8 mmol/L' },
    chart: 'WHO/ISH — khu vực SEAR-B, bản có xét nghiệm',
    percent: '28',
    band: '20 — < 30%',
    note: 'Tra theo tuổi 74, nam, đã bỏ thuốc, HA tâm thu 152 mmHg, có đái tháo đường.',
  }

  c.riskAssessment.scales = [
    {
      scaleId: 'phq2',
      answers: [2, 3],
      subscaleTotals: {},
      note: 'PHQ-2 5 điểm — dương tính, làm tiếp PHQ-9.',
      updatedAt: new Date().toISOString(),
    },
    {
      scaleId: 'phq9',
      answers: [2, 3, 2, 2, 2, 1, 1, 1, 0],
      subscaleTotals: {},
      note:
        'PHQ-9 14 điểm — trầm cảm mức trung bình. Câu 9 bằng 0: đã hỏi trực tiếp, bệnh nhân phủ nhận ý tưởng tự sát.',
      updatedAt: new Date().toISOString(),
    },
    {
      scaleId: 'gad2',
      answers: [1, 0],
      subscaleTotals: {},
      note: 'GAD-2 1 điểm — âm tính.',
      updatedAt: new Date().toISOString(),
    },
    {
      scaleId: 'isi',
      answers: [],
      subscaleTotals: { total: 16 },
      note: 'ISI 16 điểm — mất ngủ mức trung bình, chấm trên bản của bộ môn. Liên quan tiểu đêm và khí sắc trầm.',
      updatedAt: new Date().toISOString(),
    },
    {
      scaleId: 'minicog',
      answers: [3, 2],
      subscaleTotals: {},
      note: 'Mini-Cog 5/5 — âm tính. Các triệu chứng phù hợp trầm cảm hơn là sa sút trí tuệ.',
      updatedAt: new Date().toISOString(),
    },
  ]

  c.riskAssessment.overallNote =
    'Ưu tiên 1 — nguy cơ té ngã cao (té 2 lần, có chấn thương, TUG 15,5 giây): nguyên nhân đa yếu tố và ' +
    'phần lớn can thiệp được, trong đó hạ huyết áp thế đứng do thuốc là yếu tố sửa được nhanh nhất. ' +
    'Ưu tiên 2 — trầm cảm mức trung bình sau mất vợ, đang là gốc của việc bỏ bữa, quên thuốc và ngưng vận động. ' +
    'Ưu tiên 3 — kiểm soát đường huyết cần nới đích chứ không siết chặt hơn, vì nguy cơ hạ đường huyết ở người ' +
    'cao tuổi sống một mình nguy hiểm hơn HbA1c 8,4%. ' +
    'Nguy cơ tim mạch 10 năm 20–30%. Nền tảng xã hội: sống một mình, không có người nhắc thuốc, nhà ở không an toàn.'

  c.diagnosis = {
    primary: {
      id: uid('dx'),
      label: 'Té ngã tái diễn do nhiều yếu tố ở người cao tuổi',
      icd10: 'R29.6',
      icpc2: 'A29',
      status: '',
      note: 'Hạ huyết áp thế đứng do thuốc + bệnh lý thần kinh ngoại biên do đái tháo đường + yếu cơ + nhà ở không an toàn',
    },
    comorbidities: [
      { id: uid('cm'), label: 'Đái tháo đường típ 2 có biến chứng thần kinh', icd10: 'E11', icpc2: 'T90', status: 'Đang điều trị, chưa đạt đích', note: 'HbA1c 8,4%; đích nên nới rộng do nguy cơ hạ đường huyết' },
      { id: uid('cm'), label: 'Tăng huyết áp', icd10: 'I10', icpc2: 'K86', status: 'Đang điều trị, chưa đạt đích', note: '152/88 mmHg, kèm hạ huyết áp thế đứng — cần cân bằng hai chiều' },
      { id: uid('cm'), label: 'Bệnh thận mạn giai đoạn 3a', icd10: 'N18', icpc2: 'U99', status: 'Đang điều trị, ổn định', note: 'eGFR 48 — giới hạn liều metformin' },
      { id: uid('cm'), label: 'Bệnh phổi tắc nghẽn mạn tính', icd10: 'J44', icpc2: 'R95', status: 'Đang điều trị, ổn định', note: 'Tiền căn 30 gói-năm và khói hàn nghề nghiệp' },
      { id: uid('cm'), label: 'Rối loạn lipid máu', icd10: 'E78', icpc2: 'T93', status: 'Đang điều trị, ổn định', note: '' },
      { id: uid('cm'), label: 'Trầm cảm mức trung bình', icd10: 'F32', icpc2: 'P76', status: 'Mới phát hiện', note: 'PHQ-9 14 điểm, khởi phát sau khi vợ mất' },
      { id: uid('cm'), label: 'Thiếu máu nhẹ', icd10: 'D64.9', icpc2: 'B82', status: 'Mới phát hiện', note: 'Hb 11,8 g/dL — cần tìm nguyên nhân' },
    ],
    differentials: [
      { id: uid('dd'), label: 'Hạ đường huyết do thuốc', icd10: '', icpc2: '', status: '', note: 'Rất nghĩ tới: vã mồ hôi run tay buổi chiều khi bỏ bữa, đang dùng gliclazide. Cần đo đường huyết lúc có triệu chứng.' },
      { id: uid('dd'), label: 'Rối loạn nhịp tim gây choáng', icd10: '', icpc2: '', status: '', note: 'Ít nghĩ: điện tâm đồ nhịp xoang, mạch đều, không ngất thật sự.' },
      { id: uid('dd'), label: 'Bệnh lý tủy cổ chèn ép', icd10: '', icpc2: '', status: '', note: 'Ít nghĩ: không rối loạn cơ vòng, không tăng phản xạ, không dấu Babinski.' },
      { id: uid('dd'), label: 'Sa sút trí tuệ khởi đầu', icd10: '', icpc2: '', status: '', note: 'Cần theo dõi: hiện chưa có bằng chứng, con trai không ghi nhận giảm trí nhớ; các triệu chứng phù hợp trầm cảm hơn.' },
    ],
    noComorbidities: false,
    reasoning:
      'Té ngã ở người cao tuổi hầu như không bao giờ do một nguyên nhân. Ở bệnh nhân này ít nhất bốn yếu tố cùng góp: ' +
      'hạ huyết áp thế đứng ghi nhận được khi khám (152/88 nằm xuống 128/76 kèm choáng) trên nền dùng amlodipine, ' +
      'bệnh lý thần kinh ngoại biên do đái tháo đường làm mất cảm giác bảo vệ ở bàn chân, teo cơ tứ đầu đùi làm mất khả năng ' +
      'lấy lại thăng bằng, và môi trường nhà ở không an toàn quyết định nơi cũng như thời điểm té. ' +
      'Trầm cảm và việc bỏ bữa là yếu tố nền khuếch đại tất cả những điều trên. ' +
      'Điều quan trọng về mặt xử trí: siết chặt HbA1c ở bệnh nhân này sẽ làm tăng nguy cơ té ngã, tức là làm hại — ' +
      'đây là ví dụ điển hình cho việc đích điều trị phải cá thể hóa theo bối cảnh chứ không theo hướng dẫn chung.',
  }

  c.managementPlan = {
    nonPharmacological:
      'Can thiệp an toàn nhà ở: lắp tay vịn đường ra nhà vệ sinh và trong nhà vệ sinh, gắn đèn cảm ứng ban đêm, ' +
      'thảm chống trơn, hạ chiều cao giường, bố trí bình nước và đèn pin cạnh giường. ' +
      'Bài tập tăng sức cơ chi dưới và thăng bằng 15 phút mỗi ngày, khởi đầu có người hỗ trợ. ' +
      'Hướng dẫn đứng lên theo ba bước để tránh hạ huyết áp thế đứng. ' +
      'Ăn đủ ba bữa với thực đơn đơn giản; nhờ con trai gọi điện nhắc bữa và nhắc thuốc mỗi ngày.',
    patientEducation:
      'Giải thích rằng yếu chân và choáng không phải "tuổi già không chữa được" mà phần lớn do thuốc và biến chứng ' +
      'có thể can thiệp. Dạy nhận biết và xử trí hạ đường huyết: vã mồ hôi, run tay, chóng mặt thì ăn ngay 15 g đường ' +
      'nhanh rồi đo lại. Dạy dấu hiệu phải đi khám ngay: té có va đầu, đau ngực, khó thở tăng, lú lẫn.',
    followUpInterval: '2 tuần',
    followUpPlan:
      'Tái khám 2 tuần: đo huyết áp nằm và đứng, đo lại TUG, hỏi số lần choáng và té, hỏi số bữa ăn mỗi ngày, ' +
      'chấm lại PHQ-9. Sau 4 tuần đánh giá lại HbA1c sau khi giảm gliclazide. ' +
      'Một lần thăm nhà trong tháng đầu để kiểm tra các can thiệp an toàn đã được thực hiện chưa.',
    referral: {
      needed: 'yes',
      destination: 'Vật lý trị liệu, và khám chuyên khoa lão để đánh giá suy yếu toàn diện',
      reason: 'Té ngã tái diễn có chấn thương, TUG 15,5 giây, cần chương trình tập có giám sát',
      urgency: 'Sớm, trong 2 tuần',
    },
    hospitalization: { needed: 'no', reason: 'Chưa có chỉ định nhập viện; can thiệp được tại tuyến đầu' },
    goalsOfCare:
      'Trong 3 tháng: không té ngã thêm lần nào; TUG dưới 13 giây; PHQ-9 dưới 10 điểm; ăn đủ 3 bữa mỗi ngày; ' +
      'không có cơn nghi hạ đường huyết; huyết áp 130–150 mmHg tâm thu mà không có hạ huyết áp thế đứng. ' +
      'Đích HbA1c nới rộng lên 7,5–8,0% — chấp nhận cao hơn để đổi lấy an toàn.',
  }

  c.medications = [
    { id: uid('med'), name: 'Metformin', dose: '850 mg', route: 'Uống', frequency: '2 lần/ngày', duration: 'Dài hạn', indication: 'Đái tháo đường típ 2', adherence: 'Quên khi bỏ bữa', note: 'Còn dùng được với eGFR 48; theo dõi nếu eGFR giảm dưới 45' },
    { id: uid('med'), name: 'Gliclazide', dose: '30 mg', route: 'Uống', frequency: '1 lần/ngày', duration: 'Đang xem xét ngưng', indication: 'Đái tháo đường típ 2', adherence: '', note: 'Nghi là nguyên nhân các cơn hạ đường huyết — đề nghị giảm liều hoặc ngưng, ưu tiên nhóm ít gây hạ đường huyết' },
    { id: uid('med'), name: 'Amlodipine', dose: '5 mg', route: 'Uống', frequency: '1 lần/ngày', duration: 'Dài hạn', indication: 'Tăng huyết áp', adherence: '', note: 'Cân nhắc chuyển giờ uống sang buổi tối và đánh giá lại hạ huyết áp thế đứng' },
    { id: uid('med'), name: 'Atorvastatin', dose: '20 mg', route: 'Uống', frequency: '1 lần/ngày', duration: 'Dài hạn', indication: 'Rối loạn lipid máu, phòng ngừa tim mạch', adherence: '', note: '' },
    { id: uid('med'), name: 'Aspirin', dose: '81 mg', route: 'Uống', frequency: '1 lần/ngày', duration: 'Dài hạn', indication: 'Phòng ngừa tim mạch', adherence: '', note: 'Rà soát lại chỉ định: nguy cơ xuất huyết ở người té ngã tái diễn' },
  ]

  const setScreening = (id: string, status: string, result = '') => {
    const sc = c.prevention.screenings.find((x) => x.id === id)
    if (sc) {
      sc.status = status
      sc.result = result
      if (status === 'Đã làm') sc.date = todayIso()
    }
  }
  setScreening('bp', 'Đã làm', '152/88 mmHg; nằm — đứng 152/88 → 128/76')
  setScreening('glucose', 'Đã làm', 'HbA1c 8,4%')
  setScreening('lipid', 'Đã làm', 'Đang dùng statin')
  setScreening('bmi', 'Đã làm', 'BMI 21,3 — bình thường nhưng đang giảm cân')
  setScreening('crc', 'Cần làm')
  setScreening('vision', 'Cần làm', 'Mắt trái còn mờ sau mổ mắt phải')
  setScreening('depression', 'Đã làm', 'PHQ-2 5 điểm → PHQ-9 14 điểm')
  setScreening('tb', 'Không phù hợp')
  setScreening('pap', 'Không phù hợp')
  setScreening('mammo', 'Không phù hợp')

  const setVax = (id: string, status: string) => {
    const v = c.prevention.vaccinations.find((x) => x.id === id)
    if (v) v.status = status
  }
  setVax('influenza', 'Cần tiêm')
  setVax('pneumococcal', 'Cần tiêm')
  setVax('tdap', 'Cần tiêm')
  setVax('covid', 'Đã tiêm')
  setVax('zoster', 'Cần tiêm')
  setVax('hpv', 'Không phù hợp')

  c.prevention.counselling =
    'Tư vấn phòng té ngã tại nhà, cách đứng lên ba bước, nhận biết và xử trí hạ đường huyết, ' +
    'chăm sóc bàn chân đái tháo đường hằng ngày. Tư vấn tiêm cúm và phế cầu vì có bệnh phổi tắc nghẽn mạn tính. ' +
    'Trao đổi với con trai về vai trò nhắc thuốc và nhắc bữa ăn.'
  c.prevention.healthMaintenanceNote =
    'Đặt lịch tiêm cúm và phế cầu trong tháng này. Hẹn đo mật độ xương. Khám mắt định kỳ. ' +
    'Tầm soát ung thư đại trực tràng bằng xét nghiệm máu ẩn trong phân.'

  c.familyMembers = [
    { id: uid('fm'), name: '', relation: 'self', sex: 'male', ageYears: 74, alive: true, ageAtDeath: null, conditions: ['Đái tháo đường', 'Tăng huyết áp', 'Bệnh thận mạn', 'Trầm cảm'], order: 1, note: '' },
    { id: uid('fm'), name: 'Cha', relation: 'father', sex: 'male', ageYears: null, alive: false, ageAtDeath: 68, conditions: ['Nhồi máu cơ tim'], order: 0, note: '' },
    { id: uid('fm'), name: 'Mẹ', relation: 'mother', sex: 'female', ageYears: null, alive: false, ageAtDeath: 80, conditions: ['Đái tháo đường'], order: 0, note: '' },
    { id: uid('fm'), name: 'Chị gái', relation: 'sibling', sex: 'female', ageYears: 78, alive: true, ageAtDeath: null, conditions: ['Tăng huyết áp'], order: 0, note: 'Sống ở tỉnh khác' },
    { id: uid('fm'), name: 'Vợ', relation: 'spouse', sex: 'female', ageYears: null, alive: false, ageAtDeath: 70, conditions: [], order: 0, note: 'Mất năm 2023 — người chăm sóc chính trước đây' },
    { id: uid('fm'), name: 'Con trai', relation: 'child', sex: 'male', ageYears: 45, alive: true, ageAtDeath: null, conditions: [], order: 0, note: 'Người liên lạc chính, sống cách 60 km' },
    { id: uid('fm'), name: 'Con gái', relation: 'child', sex: 'female', ageYears: 42, alive: true, ageAtDeath: null, conditions: [], order: 1, note: 'Sống ở thành phố' },
  ]

  c.followUps = [
    {
      id: uid('fu'),
      date: todayIso(),
      subjective:
        'Không té thêm lần nào trong 2 tuần. Còn choáng nhẹ khi đứng lên nhưng đã biết đứng theo ba bước. ' +
        'Ăn được 3 bữa từ khi con trai gọi nhắc mỗi sáng. Không còn cơn vã mồ hôi run tay.',
      objective:
        'HA nằm 146/84, đứng 138/80 — chênh giảm rõ so với lần trước. TUG 14 giây. Cân nặng 58,5 kg. ' +
        'Con trai đã lắp tay vịn và đèn cảm ứng đường ra nhà vệ sinh.',
      assessment:
        'Nguy cơ té ngã giảm nhưng vẫn ở mức cao (TUG còn ≥ 12 giây). Hạ huyết áp thế đứng cải thiện sau khi ' +
        'chuyển amlodipine sang buổi tối và ngưng gliclazide. Trầm cảm chưa đánh giá lại.',
      plan:
        'Tiếp tục bài tập, giữ lịch vật lý trị liệu. Chấm lại PHQ-9 lần tới. Đo HbA1c sau 4 tuần. ' +
        'Tiêm cúm trong tuần này.',
      treatmentResponse: 'Không té ngã thêm; TUG giảm từ 15,5 xuống 14 giây; hết cơn nghi hạ đường huyết sau khi ngưng gliclazide.',
      adherence: 'Cải thiện rõ nhờ con trai nhắc thuốc và nhắc bữa qua điện thoại mỗi ngày',
      adverseEffects: 'Không ghi nhận',
    },
  ]

  c.reflection = {
    learned:
      'Ca này dạy tôi rằng ở người cao tuổi đa bệnh, việc điều trị "đúng hướng dẫn" cho từng bệnh riêng lẻ có thể ' +
      'gây hại khi cộng lại: gliclazide đúng cho đái tháo đường và amlodipine đúng cho tăng huyết áp, nhưng cộng với ' +
      'việc bỏ bữa và sống một mình thì hai thuốc đó chính là nguyên nhân của những lần té ngã. ' +
      'Tôi cũng học được rằng nới đích HbA1c có thể là quyết định điều trị tốt hơn là siết chặt nó.',
    difficulties:
      'Tôi thấy khó nhất là sắp thứ tự ưu tiên khi có 7 vấn đề đang hoạt động cùng lúc. Ban đầu tôi định xử trí ' +
      'đường huyết trước vì HbA1c 8,4% trông "bất thường nhất", trong khi điều thực sự đe dọa bệnh nhân là té ngã ' +
      'và trầm cảm. Tôi cũng suýt bỏ qua trầm cảm vì bệnh nhân không tự nêu — chỉ khi làm PHQ-2 mới phát hiện.',
    nextTime:
      'Với mọi bệnh nhân cao tuổi té ngã, tôi sẽ đo huyết áp nằm và đứng ngay trong lần khám đầu, và rà lại toàn bộ ' +
      'toa thuốc trước khi nghĩ đến việc thêm thuốc mới. Và sẽ làm PHQ-2 cho người cao tuổi sống một mình như một ' +
      'thói quen, không chờ bệnh nhân kể.',
    questionsForTeacher:
      'Ở bệnh nhân té ngã tái diễn đang dùng aspirin phòng ngừa tiên phát, khi nào thì lợi ích không còn bù được ' +
      'nguy cơ xuất huyết nội sọ nếu té va đầu?',
    selfRating: 3,
    tags: ['té ngã', 'đa bệnh', 'đa thuốc', 'trầm cảm người cao tuổi', 'cá thể hóa đích điều trị'],
  }

  return c
}
