/**
 * A fully worked fictional case, used for the demo and for onboarding.
 *
 * Every detail here is invented for teaching. It is never presented as a real
 * patient and carries the fictional flag in the record itself.
 */

import type { CaseRecord } from '../../types/case'
import { createEmptyCase } from '../../types/factory'
import { uid } from '../../utils/id'
import { computeBmi, todayIso } from '../../utils/format'
import { EXAM_NORMAL_BY_ID } from '../clinical'

export function buildKneeOsteoarthritisCase(): CaseRecord {
  const c = createEmptyCase('SDH', 'Ca mẫu')

  c.patient = {
    ...c.patient,
    name: 'Bà H. (giả lập)',
    sex: 'female',
    ageYears: 58,
    dateOfBirth: '1968',
    occupation: 'Nội trợ',
    education: 'Trung học cơ sở',
    ethnicity: 'Kinh',
    religion: 'Phật giáo',
    maritalStatus: 'Có gia đình',
    address: 'Phường B, thành phố C',
    insurance: 'Có bảo hiểm y tế',
  }

  c.visit = {
    ...c.visit,
    date: todayIso(),
    setting: 'Phòng khám Y học gia đình',
    encounterType: 'Khám lần đầu',
    reasonForEncounter: 'Đau khớp gối phải tăng dần, đi lại khó khăn.',
    accompaniedBy: 'Con gái',
  }

  c.quickNotes = [
    {
      id: uid('qn'),
      createdAt: new Date().toISOString(),
      text:
        'Nữ 58 tuổi, nội trợ. Đau khớp gối phải 3 tháng, tăng khi lên cầu thang. ' +
        'THA 10 năm, amlodipine 5mg 1v/ngày. Mẹ đái tháo đường. ' +
        'Không hút thuốc, không uống rượu. HA 140/85, mạch 78. 62kg, 155cm. ' +
        'Lo lắng sợ phải thay khớp.',
      filedInto: ['patient', 'history', 'personalHistory', 'lifestyle', 'examination', 'medications'],
      archived: false,
    },
  ]

  c.history = {
    chiefComplaint: 'Đau khớp gối phải',
    duration: '3 tháng',
    hpi:
      'Cách nhập viện 3 tháng, bệnh nhân bắt đầu đau âm ỉ mặt trong khớp gối phải, tăng dần. ' +
      'Đau nhiều khi lên xuống cầu thang và khi ngồi xổm đứng dậy, giảm khi nghỉ ngơi. ' +
      'Buổi sáng cứng khớp khoảng 10 phút. Không sưng nóng đỏ, không sốt. ' +
      'Bệnh nhân tự mua thuốc giảm đau uống từng đợt, đỡ ít rồi đau lại. ' +
      'Hai tuần nay đi chợ khoảng 200 m đã phải dừng nghỉ.',
    socrates: {
      site: 'Mặt trong khớp gối phải',
      onset: 'Từ từ, không sau chấn thương',
      character: 'Đau âm ỉ, có lúc nhói khi xoay gối',
      radiation: 'Không lan',
      associations: 'Cứng khớp buổi sáng ~10 phút, không sưng nóng đỏ',
      timeCourse: 'Tăng dần trong 3 tháng, nặng về chiều',
      exacerbatingRelieving: 'Tăng khi lên cầu thang và ngồi xổm; giảm khi nghỉ',
      severity: '6/10 khi vận động, 2/10 khi nghỉ',
    },
    redFlags: {
      present: [],
      absent: ['Sụt cân không chủ ý', 'Sốt kéo dài không rõ nguyên nhân', 'Đau về đêm đánh thức bệnh nhân'],
      note: 'Không có dấu hiệu nhiễm trùng khớp hay bệnh lý ác tính.',
    },
    ice: {
      ideas: 'Bệnh nhân nghĩ do "thoái hóa tuổi già" và do đi lại nhiều.',
      concerns: 'Lo lắng sợ phải mổ thay khớp và trở thành gánh nặng cho con.',
      expectations: 'Mong được kê thuốc giảm đau và hướng dẫn tập luyện tại nhà.',
    },
    systemsReview:
      'Tim mạch: không đau ngực, không khó thở khi gắng sức. Hô hấp: không ho. ' +
      'Tiêu hóa: ăn uống được, không đau thượng vị. Tiết niệu: không tiểu buốt.',
  }

  c.personalHistory.pastMedical = [
    { id: uid('pm'), label: 'Tăng huyết áp', since: '10 năm', status: 'Đang điều trị', note: 'Theo dõi tại trạm y tế' },
    { id: uid('pm'), label: 'Rối loạn lipid máu', since: '3 năm', status: 'Chưa dùng thuốc', note: '' },
  ]
  c.personalHistory.noAllergies = true
  c.personalHistory.noPastSurgical = true
  c.personalHistory.reproductive = {
    ...c.personalHistory.reproductive,
    menarcheAge: '14 tuổi',
    cycle: 'Trước đây đều',
    para: '2002',
    contraception: 'Không còn dùng',
    menopause: '51 tuổi',
    obstetricNote: 'Hai lần sinh thường, không biến chứng.',
  }

  c.lifestyle = {
    smoking: { status: 'Không hút thuốc', detail: '' },
    alcohol: { status: 'Không uống rượu bia', detail: '' },
    physicalActivity: 'Đi bộ chợ mỗi ngày, không tập thể dục có kế hoạch',
    diet: 'Ăn mặn, ít rau xanh, hay ăn cơm nguội buổi tối',
    sleep: 'Ngủ khoảng 6 giờ, hay thức giấc vì đau gối',
    substanceUse: 'Không',
    stress: 'Lo lắng về sức khỏe và kinh tế gia đình',
    occupationalExposure: 'Không',
  }

  c.familyHistory.entries = [
    { id: uid('fh'), condition: 'Đái tháo đường', relatives: 'Mẹ', note: 'Chẩn đoán năm 60 tuổi' },
    { id: uid('fh'), condition: 'Tăng huyết áp', relatives: 'Cha', note: 'Mất do đột quỵ' },
  ]
  c.familyHistory.note = 'Không ghi nhận bệnh lý cơ xương khớp di truyền.'

  c.familyMedicineAssessment = {
    familyType: 'Gia đình hạt nhân',
    familyLifeCycleStage: '7. Gia đình trung niên — tổ ấm trống',
    familyLifeCycleNote:
      'Hai con đã đi làm và sống riêng. Vợ chồng đang thích nghi với giai đoạn tổ ấm trống, ' +
      'vai trò chăm sóc sức khỏe lẫn nhau trở nên quan trọng hơn.',
    apgar: {
      adaptation: 2,
      partnership: 1,
      growth: 2,
      affection: 2,
      resolve: 1,
      note: 'Tổng 8/10 — chức năng gia đình tốt, hạn chế nhẹ về thời gian dành cho nhau.',
    },
    screem: {
      social: { resources: 'Có hàng xóm thân thiết, sinh hoạt hội phụ nữ phường', pathology: 'Ít giao tiếp từ khi đau gối' },
      cultural: { resources: 'Gia đình coi trọng chăm sóc người lớn tuổi', pathology: 'Quan niệm "đau khớp là tuổi già, không chữa được"' },
      religious: { resources: 'Sinh hoạt chùa, nguồn nâng đỡ tinh thần', pathology: '' },
      economic: { resources: 'Con gửi tiền hằng tháng, có bảo hiểm y tế', pathology: 'Thu nhập không ổn định' },
      educational: { resources: 'Biết đọc viết, tiếp thu tư vấn tốt', pathology: 'Hiểu biết hạn chế về thoái hóa khớp' },
      medical: { resources: 'Trạm y tế cách nhà 1 km, đã quen bác sĩ gia đình', pathology: 'Hay tự mua thuốc giảm đau ngoài nhà thuốc' },
    },
    homeEnvironment:
      'Nhà cấp 4, có cầu thang lên gác lửng dốc, nhà vệ sinh nền trơn — nguy cơ té ngã.',
    continuityNote:
      'Bác sĩ gia đình tại phòng khám theo dõi huyết áp mỗi 3 tháng; bổ sung theo dõi khớp gối và cân nặng mỗi 4 tuần trong 3 tháng đầu.',
  }

  c.examination.generalAppearance =
    'Tỉnh, tiếp xúc tốt, thể trạng béo phì độ I (ngưỡng châu Á), da niêm hồng, không phù, dáng đi hơi khập khiễng chân phải.'
  c.examination.vitals = {
    temperatureC: '37',
    pulse: '78',
    respiratoryRate: '18',
    systolic: '140',
    diastolic: '85',
    spo2: '98',
    heightCm: '155',
    weightKg: '62',
    waistCm: '88',
    bmi: computeBmi('155', '62'),
  }
  const setSystem = (id: string, status: 'normal' | 'abnormal', findings?: string) => {
    const s = c.examination.systems.find((x) => x.id === id)
    if (s) {
      s.status = status
      s.findings = findings ?? EXAM_NORMAL_BY_ID[id] ?? ''
    }
  }
  setSystem('cardiovascular', 'normal')
  setSystem('respiratory', 'normal')
  setSystem('abdomen', 'normal')
  setSystem('skin', 'normal')
  setSystem('musculoskeletal', 'abnormal',
    'Khớp gối phải: ấn đau khe khớp trong, lạo xạo khi vận động, tầm vận động gấp giảm nhẹ, ' +
    'không sưng nóng đỏ, không tràn dịch. Khớp gối trái bình thường. Cơ tứ đầu đùi phải teo nhẹ.')

  c.investigations.proposed = [
    { id: uid('inv'), name: 'X-quang khớp gối hai bên tư thế đứng' },
    { id: uid('inv'), name: 'Đường huyết đói' },
    { id: uid('inv'), name: 'Bộ mỡ máu' },
    { id: uid('inv'), name: 'Creatinin — eGFR' },
  ]
  c.investigations.results = [
    { id: uid('res'), name: 'Đường huyết đói', date: todayIso(), value: '5,6', unit: 'mmol/L', flag: 'normal', interpretation: 'Trong giới hạn bình thường', attachmentId: null },
    { id: uid('res'), name: 'LDL-C', date: todayIso(), value: '3,8', unit: 'mmol/L', flag: 'abnormal', interpretation: 'Tăng so với đích điều trị', attachmentId: null },
  ]
  c.investigations.summary =
    'X-quang gối phải: hẹp khe khớp đùi — chày trong, gai xương bờ khớp. Đường huyết đói 5,6 mmol/L. ' +
    'LDL-C 3,8 mmol/L. Creatinin và eGFR trong giới hạn bình thường.'

  c.investigations.interpretation = {
    abnormal:
      'Chỉ có LDL-C 3,8 mmol/L là bất thường, tăng so với đích < 3,0 mmol/L ở người có nhiều yếu tố nguy cơ tim mạch. ' +
      'X-quang có tổn thương cấu trúc nhưng đó là kết quả mong đợi của chẩn đoán, không phải phát hiện ngoài dự kiến.',
    supportsDiagnosis:
      'Ủng hộ thoái hóa khớp gối: hẹp khe khớp đùi — chày trong kèm gai xương bờ khớp là hình ảnh đặc trưng, ' +
      'và vị trí tổn thương trên X-quang khớp với điểm đau khi khám. ' +
      'Không ủng hộ viêm khớp dạng thấp hay viêm khớp nhiễm khuẩn: không có bằng chứng viêm hệ thống, ' +
      'nên chưa cần làm RF, anti-CCP hay chọc dịch khớp ở thời điểm này. ' +
      'Đường huyết bình thường loại trừ đái tháo đường mặc dù mẹ có tiền căn.',
    inconsistencies:
      'Không có kết quả nào lệch với bệnh cảnh. Mức độ hẹp khe khớp trên X-quang (độ II) nhẹ hơn mức đau ' +
      'bệnh nhân mô tả — nhắc rằng mức độ đau trong thoái hóa khớp tương quan kém với hình ảnh, và yếu cơ ' +
      'tứ đầu đùi cùng yếu tố tâm lý góp phần vào cảm nhận đau.',
    impactOnPlan:
      'X-quang xác nhận chẩn đoán nên chuyển hướng sang điều trị bảo tồn thay vì tìm thêm nguyên nhân. ' +
      'Creatinin bình thường cho phép dùng NSAID ngắn ngày nếu cần. ' +
      'LDL-C tăng thêm một đích can thiệp mới bằng lối sống, đánh giá lại sau 3 tháng trước khi bàn về statin.',
  }

  const setRisk = (id: string, present: 'yes' | 'no', note = '') => {
    const f = c.riskAssessment.factors.find((x) => x.id === id)
    if (f) {
      f.present = present
      f.note = note
    }
  }
  // 1. Cấp cứu — rà soát và loại trừ hết.
  for (const id of [
    'em.chestPain', 'em.dyspnoea', 'em.neuroDeficit', 'em.severeHypertension',
    'em.sepsis', 'em.bleeding', 'em.suicidal', 'em.violence', 'em.dehydration',
    'em.hypoglycaemia', 'em.headTrauma',
  ]) setRisk(id, 'no')

  // 2. Hành vi
  setRisk('bh.smoking', 'no')
  setRisk('bh.secondhandSmoke', 'no')
  setRisk('bh.alcohol', 'no')
  setRisk('bh.inactivity', 'yes', 'Chỉ đi chợ, không tập luyện có kế hoạch')
  setRisk('bh.diet', 'yes', 'Ăn mặn, ít rau xanh')
  setRisk('bh.substance', 'no')
  setRisk('bh.sleep', 'yes', 'Ngủ 6 giờ, thức giấc vì đau gối')

  // 3. Tim mạch — chuyển hóa
  setRisk('cm.hypertension', 'yes', '10 năm, đang dùng amlodipine 5 mg')
  setRisk('cm.diabetes', 'no', 'Đường huyết đói 5,6 mmol/L')
  setRisk('cm.dyslipidemia', 'yes', 'LDL-C 3,8 mmol/L')
  setRisk('cm.obesity', 'yes', 'BMI 25,8 — béo phì độ I theo ngưỡng châu Á')
  setRisk('cm.centralObesity', 'yes', 'Vòng eo 88 cm (nữ ≥ 80 cm)')
  setRisk('cm.familyCvd', 'yes', 'Cha mất do đột quỵ ở tuổi 78 — không phải khởi phát sớm')
  setRisk('cm.ckd', 'no', 'Creatinin và eGFR trong giới hạn bình thường')
  setRisk('cm.atrialFibrillation', 'no', 'Mạch đều 78 lần/phút')

  // 4. Ung thư — theo tuổi và giới
  setRisk('ca.cervix', 'yes', 'Chưa từng làm Pap smear')
  setRisk('ca.breast', 'yes', 'Chưa từng chụp nhũ ảnh')
  setRisk('ca.colorectal', 'yes', 'Chưa tầm soát, đã hẹn xét nghiệm máu ẩn trong phân')
  setRisk('ca.lung', 'no', 'Không hút thuốc')
  setRisk('ca.liver', 'no', 'HBsAg âm tính')
  setRisk('ca.stomach', 'no')
  setRisk('ca.familyEarly', 'no')

  // 5. Lão khoa
  setRisk('ge.falls', 'no', 'Chưa té ngã trong 12 tháng qua')
  setRisk('ge.homeHazard', 'yes', 'Cầu thang dốc, nhà vệ sinh nền trơn')
  setRisk('ge.polypharmacy', 'no', 'Đang dùng 2 loại thuốc')
  setRisk('ge.sensory', 'no')
  setRisk('ge.malnutrition', 'no')
  setRisk('ge.incontinence', 'no')
  setRisk('ge.osteoporosis', 'no', 'Chưa đo mật độ xương, không tiền căn gãy xương')

  // 6. Nhận thức
  setRisk('cg.memoryComplaint', 'no')
  setRisk('cg.dementiaRisk', 'yes', 'Tăng huyết áp và ít vận động là yếu tố nguy cơ điều chỉnh được')
  setRisk('cg.adherence', 'yes', 'Quên thuốc huyết áp khoảng 2 lần mỗi tuần')

  // 7. Tâm lý
  setRisk('ps.depression', 'no', 'PHQ-2 âm tính')
  setRisk('ps.anxiety', 'no')
  setRisk('ps.chronicStress', 'yes', 'Lo về sức khỏe và kinh tế gia đình')
  setRisk('ps.grief', 'no')
  setRisk('ps.caregiverBurden', 'no')
  setRisk('ps.illnessBelief', 'yes', 'Tin rằng "đau khớp tuổi già không chữa được"')

  // 8. Xã hội — SCREEM đã bao trùm, chỉ còn câu phải hỏi riêng
  setRisk('so.domesticViolence', 'no')

  // 9. Môi trường
  setRisk('en.occupational', 'no')
  setRisk('en.indoorSmoke', 'no', 'Dùng bếp gas')
  setRisk('en.housing', 'no')
  setRisk('en.waterSanitation', 'no')

  c.riskAssessment.recall = {
    emergency: {
      text: '- đau ngực\n- khó thở\n- huyết áp quá cao',
      revealedAt: new Date().toISOString(),
    },
    behavioural: {
      text: '- hút thuốc\n- rượu bia\n- ít vận động\n- ăn mặn',
      revealedAt: new Date().toISOString(),
    },
    cardiometabolic: {
      text: '- tăng huyết áp\n- mỡ máu\n- béo phì\n- gia đình bị tim mạch',
      revealedAt: new Date().toISOString(),
    },
    geriatric: {
      text: '- té ngã\n- loãng xương',
      revealedAt: new Date().toISOString(),
    },
  }

  c.riskAssessment.falls = {
    fellPastYear: 'no',
    fallCount: '',
    injured: 'unknown',
    feelsUnsteady: 'yes',
    worriesAboutFalling: 'yes',
    timedUpAndGoSeconds: '11.5',
    chairStandCount: '9',
    note: 'Chưa té nhưng mất vững khi xuống cầu thang; yếu cơ tứ đầu đùi phải.',
  }

  c.riskAssessment.cvd = {
    inputs: { age: '58', sex: 'Nữ', smoking: 'Không hút thuốc', sbp: '140', diabetes: 'Không', cholesterol: '5,4 mmol/L' },
    chart: 'WHO/ISH — khu vực SEAR-B, bản không cần xét nghiệm',
    percent: '12',
    band: '10 — < 20%',
    note: 'Tra theo tuổi 58, nữ, không hút thuốc, HA tâm thu 140 mmHg, không đái tháo đường.',
  }

  c.riskAssessment.scales = [
    {
      scaleId: 'phq2',
      answers: [1, 0],
      subscaleTotals: {},
      note: 'PHQ-2 âm tính (1 điểm) — không cần làm tiếp PHQ-9.',
      updatedAt: new Date().toISOString(),
    },
    {
      scaleId: 'gad2',
      answers: [1, 1],
      subscaleTotals: {},
      note: 'GAD-2 2 điểm, dưới ngưỡng; lo lắng khu trú vào bệnh khớp chứ không lan tỏa.',
      updatedAt: new Date().toISOString(),
    },
  ]

  c.riskAssessment.overallNote =
    'Ưu tiên 1 — nguy cơ tim mạch chuyển hóa cộng dồn: béo phì độ I, béo trung tâm, tăng huyết áp chưa đạt đích, ' +
    'rối loạn lipid máu, ít vận động. Ưu tiên 2 — an toàn tại nhà: cầu thang dốc và nền trơn trên nền yếu cơ tứ đầu đùi. ' +
    'Ưu tiên 3 — khoảng trống dự phòng: chưa tầm soát ung thư cổ tử cung, ung thư vú và ung thư đại trực tràng. ' +
    'Nền tảng tâm lý — xã hội: niềm tin sai lệch về bệnh và khó khăn kinh tế là hai rào cản tuân thủ chính, ' +
    'cần xử lý ngay trong tư vấn thay vì chỉ kê thuốc.'

  c.diagnosis = {
    primary: { id: uid('dx'), label: 'Thoái hóa khớp gối phải', icd10: 'M17', icpc2: 'L90', status: '', note: 'Độ II theo X-quang' },
    comorbidities: [
      { id: uid('cm'), label: 'Tăng huyết áp', icd10: 'I10', icpc2: 'K86', status: 'Đang điều trị, chưa đạt đích', note: '10 năm, HA hiện 140/85 mmHg' },
      { id: uid('cm'), label: 'Rối loạn lipid máu', icd10: 'E78', icpc2: 'T93', status: 'Chưa điều trị', note: 'LDL-C 3,8 mmol/L' },
      { id: uid('cm'), label: 'Béo phì độ I', icd10: 'E66', icpc2: 'T82', status: 'Chưa điều trị', note: 'BMI 25,8 — ngưỡng châu Á, vòng eo 88 cm' },
    ],
    differentials: [
      { id: uid('dd'), label: 'Viêm khớp dạng thấp', icd10: '', icpc2: '', status: '', note: 'Ít nghĩ: đau một khớp, cứng khớp buổi sáng chỉ 10 phút, không viêm nhiều khớp đối xứng.' },
      { id: uid('dd'), label: 'Bệnh gout', icd10: '', icpc2: '', status: '', note: 'Ít nghĩ: không có cơn đau cấp dữ dội, không sưng nóng đỏ.' },
      { id: uid('dd'), label: 'Đau quy chiếu từ khớp háng', icd10: '', icpc2: '', status: '', note: 'Ít nghĩ: khám khớp háng bình thường, điểm đau khu trú tại khe khớp gối.' },
    ],
    noComorbidities: false,
    reasoning:
      'Ủng hộ thoái hóa khớp gối: nữ 58 tuổi, béo phì độ I, đau cơ học tăng khi chịu lực và giảm khi nghỉ, ' +
      'cứng khớp buổi sáng dưới 30 phút, lạo xạo khi vận động, X-quang có hẹp khe khớp và gai xương. ' +
      'Không có dấu hiệu viêm hệ thống hay nhiễm trùng khớp nên chưa cần xét nghiệm miễn dịch ở thời điểm này.',
  }

  c.managementPlan = {
    nonPharmacological:
      'Giảm 5–7% cân nặng trong 6 tháng. Tập cơ tứ đầu đùi 10–15 phút mỗi ngày theo bài hướng dẫn. ' +
      'Đi bộ trên mặt phẳng, tránh ngồi xổm và lên xuống cầu thang nhiều. ' +
      'Lắp tay vịn cầu thang và thảm chống trơn nhà vệ sinh để giảm nguy cơ té ngã.',
    patientEducation:
      'Giải thích thoái hóa khớp là bệnh mạn tính có thể kiểm soát tốt bằng giảm cân và tập luyện; ' +
      'phẫu thuật thay khớp chỉ đặt ra khi điều trị bảo tồn thất bại và ảnh hưởng nặng chức năng. ' +
      'Hướng dẫn không tự mua NSAID kéo dài.',
    followUpInterval: '4 tuần',
    followUpPlan:
      'Tái khám sau 4 tuần: đánh giá thang điểm đau, khả năng đi bộ, cân nặng, huyết áp. ' +
      'Quay lại sớm nếu khớp sưng nóng đỏ, sốt, hoặc đau tăng đột ngột.',
    referral: { needed: 'no', destination: '', reason: 'Chưa có chỉ định ngoại khoa ở thời điểm hiện tại', urgency: '' },
    hospitalization: { needed: 'no', reason: '' },
    goalsOfCare:
      'Trong 3 tháng: đau khi vận động ≤ 3/10, đi bộ liên tục 15 phút không phải nghỉ, ' +
      'huyết áp < 140/90 mmHg, giảm 3 kg.',
  }

  c.medications = [
    { id: uid('med'), name: 'Amlodipine', dose: '5 mg', route: 'Uống', frequency: '1 lần/ngày', duration: 'Dài hạn', indication: 'Kiểm soát huyết áp', adherence: 'Quên thuốc khoảng 2 lần/tuần', note: '' },
    { id: uid('med'), name: 'Paracetamol', dose: '500 mg', route: 'Uống', frequency: '3 lần/ngày', duration: 'Khi đau, tối đa 7 ngày', indication: 'Giảm đau khớp gối', adherence: '', note: 'Không quá 3 g/ngày' },
  ]

  const setScreening = (id: string, status: string, result = '') => {
    const s = c.prevention.screenings.find((x) => x.id === id)
    if (s) {
      s.status = status
      s.result = result
      if (status === 'Đã làm') s.date = todayIso()
    }
  }
  setScreening('bp', 'Đã làm', '140/85 mmHg')
  setScreening('glucose', 'Đã làm', '5.6 mmol/L')
  setScreening('lipid', 'Đã làm', 'LDL-C 3.8 mmol/L')
  setScreening('bmi', 'Đã làm', 'BMI 25,8 — béo phì độ I (ngưỡng châu Á); vòng eo 88 cm')
  setScreening('pap', 'Cần làm')
  setScreening('mammo', 'Cần làm')
  setScreening('crc', 'Cần làm')
  setScreening('depression', 'Đã làm', 'PHQ-2 âm tính')

  const setVax = (id: string, status: string) => {
    const v = c.prevention.vaccinations.find((x) => x.id === id)
    if (v) v.status = status
  }
  setVax('influenza', 'Cần tiêm')
  setVax('pneumococcal', 'Cần tiêm')
  setVax('tdap', 'Đã tiêm')
  setVax('covid', 'Đã tiêm')
  setVax('hpv', 'Không phù hợp')

  c.prevention.counselling =
    'Tư vấn giảm muối dưới 5 g/ngày, tăng rau xanh, đi bộ 30 phút x 5 ngày/tuần khi hết đợt đau cấp. ' +
    'Hướng dẫn nhận biết dấu hiệu cần khám ngay: khớp sưng nóng đỏ, sốt, đau ngực, yếu nửa người.'
  c.prevention.healthMaintenanceNote =
    'Đặt lịch tầm soát ung thư cổ tử cung và ung thư vú trong 3 tháng tới; nhắc tiêm cúm mùa vào đầu mùa dịch.'

  c.familyMembers = [
    { id: uid('fm'), name: 'Bà H.', relation: 'self', sex: 'female', ageYears: 58, alive: true, ageAtDeath: null, conditions: ['Tăng huyết áp', 'Thoái hóa khớp gối'], order: 2, note: 'Bệnh nhân' },
    { id: uid('fm'), name: 'Cha', relation: 'father', sex: 'male', ageYears: null, alive: false, ageAtDeath: 78, conditions: ['Tăng huyết áp', 'Đột quỵ'], order: 0, note: '' },
    { id: uid('fm'), name: 'Mẹ', relation: 'mother', sex: 'female', ageYears: 82, alive: true, ageAtDeath: null, conditions: ['Đái tháo đường'], order: 0, note: 'Sống cùng anh trai' },
    { id: uid('fm'), name: 'Anh trai', relation: 'sibling', sex: 'male', ageYears: 62, alive: true, ageAtDeath: null, conditions: [], order: 1, note: '' },
    { id: uid('fm'), name: 'Chồng', relation: 'spouse', sex: 'male', ageYears: 61, alive: true, ageAtDeath: null, conditions: ['Tăng huyết áp'], order: 0, note: '' },
    { id: uid('fm'), name: 'Con gái', relation: 'child', sex: 'female', ageYears: 32, alive: true, ageAtDeath: null, conditions: [], order: 0, note: 'Sống riêng' },
    { id: uid('fm'), name: 'Con trai', relation: 'child', sex: 'male', ageYears: 29, alive: true, ageAtDeath: null, conditions: [], order: 1, note: 'Làm việc xa nhà' },
  ]

  c.followUps = [
    {
      id: uid('fu'),
      date: todayIso(),
      subjective: 'Đau gối giảm còn 4/10, đi bộ được khoảng 400 m mới phải nghỉ.',
      objective: 'HA 136/82 mmHg, cân nặng 61 kg. Khớp gối phải còn ấn đau nhẹ khe khớp trong.',
      assessment: 'Thoái hóa khớp gối phải đáp ứng một phần với điều trị bảo tồn. Huyết áp cải thiện.',
      plan: 'Duy trì bài tập cơ tứ đầu đùi, tiếp tục amlodipine, hẹn tái khám sau 4 tuần.',
      treatmentResponse: 'Đau giảm từ 6/10 xuống 4/10 sau 4 tuần.',
      adherence: 'Uống thuốc huyết áp đều hơn nhờ hộp chia thuốc',
      adverseEffects: 'Không ghi nhận',
    },
  ]

  c.reflection = {
    learned:
      'Ca này cho tôi thấy chẩn đoán thoái hóa khớp gối không khó, nhưng phần quyết định kết quả lại nằm ở ' +
      'chỗ khác: bệnh nhân tin rằng "đau khớp tuổi già không chữa được" nên đã tự mua thuốc giảm đau từng đợt ' +
      'suốt ba tháng. Khi khai thác ICE mới thấy nỗi lo thật là sợ phải thay khớp và sợ thành gánh nặng cho con. ' +
      'Giải quyết niềm tin đó quan trọng hơn việc kê thêm một loại thuốc.',
    difficulties:
      'Tôi còn khó khi phải nối dữ kiện gia đình với kế hoạch điều trị: biết Family APGAR 8/10 và cầu thang dốc, ' +
      'nhưng lúc đầu vẫn viết kế hoạch chỉ gồm thuốc và tập luyện, chưa đưa can thiệp an toàn tại nhà vào.',
    nextTime:
      'Hỏi ICE ngay sau bệnh sử thay vì để cuối, và mỗi khi ghi một yếu tố nguy cơ tâm lý — xã hội thì viết luôn ' +
      'một hành động tương ứng trong kế hoạch xử trí.',
    questionsForTeacher:
      'Với bệnh nhân béo phì độ I kèm thoái hóa khớp gối, nên đặt đích giảm cân bao nhiêu phần trăm trong 3 tháng ' +
      'để vừa khả thi vừa có ý nghĩa lâm sàng?',
    selfRating: 3,
    tags: ['thoái hóa khớp gối', 'ICE', 'tư vấn giảm cân', 'nguy cơ té ngã'],
  }

  return c
}
