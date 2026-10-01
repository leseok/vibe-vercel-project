/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useId } from 'react';
import {
  Coffee,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Clock,
  Phone,
  User,
  MessageSquare,
  FileSpreadsheet,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  Receipt,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ==========================================
// 음료 목록 및 가격 데이터 정의
// ==========================================
interface Beverage {
  id: string;
  name: string;
  price: number;
}

const BEVERAGES: Beverage[] = [
  { id: 'americano', name: '아메리카노', price: 3500 },
  { id: 'latte', name: '카페라떼', price: 4000 },
  { id: 'mocha', name: '카페모카', price: 4500 },
  { id: 'vanilla-latte', name: '바닐라라떼', price: 4500 },
  { id: 'greentea-latte', name: '녹차라떼', price: 4500 },
];

// ==========================================
// 사이즈 목록 및 추가 금액 정의
// ==========================================
interface SizeOption {
  id: 'S' | 'M' | 'L';
  name: string;
  label: string;
  price: number;
}

const SIZES: SizeOption[] = [
  { id: 'S', name: 'S사이즈', label: 'S (+0원)', price: 0 },
  { id: 'M', name: 'M사이즈', label: 'M (+500원)', price: 500 },
  { id: 'L', name: 'L사이즈', label: 'L (+1,000원)', price: 1000 },
];

// ==========================================
// 추가 옵션 목록 및 가격 정의
// ==========================================
interface ExtraOption {
  id: string;
  name: string;
  label: string;
  price: number;
}

const EXTRA_OPTIONS: ExtraOption[] = [
  { id: 'shot', name: '샷 추가', label: '샷 추가 (+500원)', price: 500 },
  { id: 'cream', name: '크림 추가', label: '크림 추가 (+500원)', price: 500 },
  { id: 'syrup', name: '시럽 추가', label: '시럽 추가 (+300원)', price: 300 },
  { id: 'decaf', name: '디카페인', label: '디카페인 (+0원)', price: 0 },
];

// ==========================================
// 저장된 주문 데이터 타입 정의 (LocalStorage & Excel 호환)
// ==========================================
interface SavedOrder {
  id: string;
  orderNumber: string; // 주문번호 (예: ORD-20260930-001)
  orderDate: string; // 주문 일시 (YYYY-MM-DD HH:mm:ss)
  customerName: string; // 주문자명
  phoneNumber: string; // 전화번호
  beverageName: string; // 음료명
  sizeName: string; // 사이즈
  options: string; // 선택된 옵션 목록 텍스트
  quantity: number; // 수량
  basePrice: number; // 음료 기본가
  sizePrice: number; // 사이즈 추가금
  optionsPrice: number; // 옵션 추가금
  unitPrice: number; // 1잔당 단가
  totalPrice: number; // 총 주문 금액
  specialRequest: string; // 요청사항
}

const STORAGE_KEY = 'vibe_cafe_saved_orders';

export default function App() {
  // 웹 접근성을 위한 고유 ID 생성 (useId)
  const nameInputId = useId();
  const phoneInputId = useId();
  const drinkSelectId = useId();
  const quantityInputId = useId();
  const requestTextareaId = useId();

  // ==========================================
  // 폼 입력 상태 관리 (State)
  // ==========================================
  const [customerName, setCustomerName] = useState<string>(''); // 고객 이름 (필수)
  const [phoneNumber, setPhoneNumber] = useState<string>(''); // 전화번호
  const [selectedBeverageId, setSelectedBeverageId] = useState<string>(''); // 선택된 음료 ID
  const [selectedSizeId, setSelectedSizeId] = useState<'S' | 'M' | 'L'>('M'); // 사이즈 (기본값: M)
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]); // 선택된 추가 옵션 ID 배열
  const [quantity, setQuantity] = useState<number>(1); // 수량 (기본값: 1, 최소 1, 최대 10)
  const [specialRequest, setSpecialRequest] = useState<string>(''); // 요청사항

  // 주문 접수 메시지 및 에러 상태
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ==========================================
  // 자료 영구 저장 (LocalStorage) 상태 관리
  // ==========================================
  const [savedOrders, setSavedOrders] = useState<SavedOrder[]>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          return JSON.parse(stored) as SavedOrder[];
        }
      }
    } catch (e) {
      console.error('로컬스토리지 불러오기 오류:', e);
    }
    return [];
  });

  // 주문 내역 아코디언 펼침/접힘 상태
  const [showHistory, setShowHistory] = useState<boolean>(true);
  // 안내 메시지 상태
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // 삭제 확인 모달 상태 (window.confirm 대체)
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<'all' | string | null>(null);

  // savedOrders 상태가 변경될 때마다 로컬스토리지에 자동 저장 (자료 영구 보존)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedOrders));
      }
    } catch (e) {
      console.error('로컬스토리지 저장 실패:', e);
    }
  }, [savedOrders]);

  // ==========================================
  // 실시간 예상 금액 계산 로직
  // ==========================================
  const currentBeverage = BEVERAGES.find((b) => b.id === selectedBeverageId);
  const baseDrinkPrice = currentBeverage ? currentBeverage.price : 0;

  const currentSize = SIZES.find((s) => s.id === selectedSizeId);
  const sizeExtraPrice = currentSize ? currentSize.price : 0;

  const optionsExtraPrice = selectedOptions.reduce((sum, optId) => {
    const opt = EXTRA_OPTIONS.find((o) => o.id === optId);
    return sum + (opt ? opt.price : 0);
  }, 0);

  // 1잔당 단가 계산 (음료 미선택 시 0원)
  const singleCupPrice = currentBeverage
    ? baseDrinkPrice + sizeExtraPrice + optionsExtraPrice
    : 0;

  // 총 예상 금액 = 단가 * 수량
  const estimatedTotalPrice = singleCupPrice * quantity;

  // ==========================================
  // 옵션 체크박스 변경 핸들러
  // ==========================================
  const handleOptionToggle = (optionId: string) => {
    setSelectedOptions((prev) =>
      prev.includes(optionId)
        ? prev.filter((id) => id !== optionId)
        : [...prev, optionId]
    );
  };

  // ==========================================
  // 수량 변경 핸들러 (1 ~ 10 제한)
  // ==========================================
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val)) {
      setQuantity(1);
    } else if (val < 1) {
      setQuantity(1);
    } else if (val > 10) {
      setQuantity(10);
    } else {
      setQuantity(val);
    }
  };

  // ==========================================
  // 주문하기 버튼 클릭 핸들러 (자료 저장 포함)
  // ==========================================
  const handleOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. 이름 필수 유효성 검사
    if (!customerName.trim()) {
      setErrorMessage('이름을 입력해주세요');
      setConfirmationMessage(null);
      return;
    }

    // 2. 음료 선택 유효성 검사
    if (!selectedBeverageId || !currentBeverage) {
      setErrorMessage('음료를 선택해주세요');
      setConfirmationMessage(null);
      return;
    }

    setErrorMessage(null);

    // 추가 옵션 이름 텍스트 생성
    const selectedOptionNames = selectedOptions
      .map((id) => EXTRA_OPTIONS.find((o) => o.id === id)?.name)
      .filter(Boolean);
    const optionsText =
      selectedOptionNames.length > 0
        ? ` (${selectedOptionNames.join(', ')})`
        : '';
    const optionsString = selectedOptionNames.length > 0 ? selectedOptionNames.join(', ') : '없음';

    const formattedPrice = estimatedTotalPrice.toLocaleString();
    const resultMessage = `${customerName.trim()}님, ${currentBeverage.name} ${currentSize?.name}${optionsText} ${quantity}잔, 총 ${formattedPrice}원 주문이 접수되었습니다!`;

    setConfirmationMessage(resultMessage);

    // ==========================================
    // 자료 저장: 입력 및 클릭한 데이터를 주문 객체로 생성하여 영구 보관
    // ==========================================
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNum = `ORD-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${randomSuffix}`;
    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ord_${Date.now()}_${randomSuffix}`;

    const newOrder: SavedOrder = {
      id: newId,
      orderNumber: orderNum,
      orderDate: formattedDate,
      customerName: customerName.trim(),
      phoneNumber: phoneNumber.trim() || '미입력',
      beverageName: currentBeverage.name,
      sizeName: currentSize?.name || 'M사이즈',
      options: optionsString,
      quantity: quantity,
      basePrice: baseDrinkPrice,
      sizePrice: sizeExtraPrice,
      optionsPrice: optionsExtraPrice,
      unitPrice: singleCupPrice,
      totalPrice: estimatedTotalPrice,
      specialRequest: specialRequest.trim() || '없음',
    };

    // 최신 주문이 상단에 오도록 목록 앞에 추가 및 로컬스토리지 자동 반영
    setSavedOrders((prev) => [newOrder, ...prev]);

    // 알림 메시지 일시 표시
    setNoticeMessage('주문 내용이 성공적으로 저장되었습니다. 아래에서 엑셀로 내려받으실 수 있습니다.');
    setTimeout(() => {
      setNoticeMessage(null);
    }, 4000);
  };

  // ==========================================
  // 다시 작성 (초기화) 버튼 핸들러
  // ==========================================
  const handleReset = () => {
    setCustomerName('');
    setPhoneNumber('');
    setSelectedBeverageId('');
    setSelectedSizeId('M');
    setSelectedOptions([]);
    setQuantity(1);
    setSpecialRequest('');
    setConfirmationMessage(null);
    setErrorMessage(null);
  };

  // ==========================================
  // 엑셀(.xlsx) 파일 생성 및 안전한 Blob 다운로드 기능
  // ==========================================
  const exportToExcel = () => {
    if (savedOrders.length === 0) {
      setErrorMessage('저장된 주문 자료가 없습니다. 먼저 음료를 주문해주세요.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    // 엑셀 시트에 기록할 한글 열 매핑 데이터 가공
    const excelData = savedOrders.map((order, index) => ({
      '번호': savedOrders.length - index,
      '주문번호': order.orderNumber,
      '주문일시': order.orderDate,
      '주문자명': order.customerName,
      '전화번호': order.phoneNumber,
      '음료명': order.beverageName,
      '사이즈': order.sizeName,
      '추가옵션': order.options,
      '수량': order.quantity,
      '음료기본가(원)': order.basePrice,
      '사이즈추가금(원)': order.sizePrice,
      '옵션추가금(원)': order.optionsPrice,
      '1잔당단가(원)': order.unitPrice,
      '총결제금액(원)': order.totalPrice,
      '요청사항': order.specialRequest,
    }));

    // SheetJS 워크시트 생성
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // 컬럼 폭 자동 지정
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 22 },
      { wch: 20 },
      { wch: 12 },
      { wch: 15 },
      { wch: 14 },
      { wch: 10 },
      { wch: 20 },
      { wch: 8 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 25 },
    ];

    // 워크북 생성 및 시트 추가
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '바이브카페_주문목록');

    const todayStr = new Date().toISOString().split('T')[0];
    const fileName = `바이브카페_주문자료_${todayStr}.xlsx`;

    try {
      // Blob 방식의 안전한 브라우저 다운로드
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setNoticeMessage(`엑셀 파일(${fileName})이 정상적으로 다운로드되었습니다!`);
      setTimeout(() => {
        setNoticeMessage(null);
      }, 4000);
    } catch (err) {
      console.error('엑셀 파일 생성 중 오류:', err);
      // Fallback
      XLSX.writeFile(workbook, fileName);
    }
  };

  // 삭제 확정 실행
  const executeDelete = () => {
    if (deleteConfirmTarget === 'all') {
      setSavedOrders([]);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.error(e);
      }
      setNoticeMessage('모든 저장 주문 기록이 삭제되었습니다.');
    } else if (typeof deleteConfirmTarget === 'string') {
      setSavedOrders((prev) => prev.filter((order) => order.id !== deleteConfirmTarget));
      setNoticeMessage('해당 주문 기록이 삭제되었습니다.');
    }
    setDeleteConfirmTarget(null);
    setTimeout(() => setNoticeMessage(null), 3000);
  };

  return (
    <div className="min-h-screen bg-[#faf6f0] py-8 px-4 flex flex-col items-center justify-start text-[#3e2723]">
      {/* 최대 너비 520px 가운데 정렬 컨테이너 */}
      <div className="w-full max-w-[520px] bg-white rounded-2xl shadow-[0_8px_30px_rgb(107,66,38,0.08)] border border-[#ebdcd0] overflow-hidden">
        
        {/* ==========================================
            페이지 상단 카페 로고 및 헤더 영역
           ========================================== */}
        <header className="bg-gradient-to-b from-[#f5ede3] to-white pt-8 pb-6 px-6 text-center border-b border-[#f0e4d7]">
          {/* 카페 로고: ☕ 이모지 크게 */}
          <div className="text-6xl mb-2 select-none transform hover:scale-110 transition-transform duration-200 inline-block">
            ☕
          </div>
          {/* 카페 이름 */}
          <h1 className="text-3xl font-bold tracking-tight text-[#6b4226] mb-1">
            바이브 카페
          </h1>
          {/* 부제 */}
          <p className="text-sm font-medium text-[#8d6e63]">
            당신의 하루에 바이브를 더하다
          </p>
          
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[#a1887f]">
            <span className="inline-flex items-center gap-1 bg-[#f7f1e9] px-2.5 py-1 rounded-full border border-[#e8ded2]">
              <Sparkles className="w-3.5 h-3.5 text-[#6b4226]" />
              신선한 프리미엄 원두
            </span>
            <span className="inline-flex items-center gap-1 bg-[#f7f1e9] px-2.5 py-1 rounded-full border border-[#e8ded2]">
              <Clock className="w-3.5 h-3.5 text-[#6b4226]" />
              빠른 간편 주문
            </span>
          </div>
        </header>

        {/* ==========================================
            주문서 폼 영역
           ========================================== */}
        <form onSubmit={handleOrderSubmit} className="p-6 space-y-5">

          {/* 에러 경고 알림 배너 */}
          {errorMessage && (
            <div
              role="alert"
              className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. 이름 (필수, text) */}
          <div>
            <label
              htmlFor={nameInputId}
              className="flex items-center gap-1 text-sm font-semibold text-[#5d4037] mb-1.5"
            >
              <User className="w-4 h-4 text-[#8d6e63]" />
              <span>이름</span>
              <span className="text-red-500 font-bold" title="필수 입력">*</span>
            </label>
            <input
              id={nameInputId}
              type="text"
              required
              placeholder="주문자 성함을 입력해주세요 (예: 홍길동)"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                if (errorMessage && e.target.value.trim()) setErrorMessage(null);
              }}
              className="cafe-input text-sm text-[#3e2723] placeholder:text-[#bcaaa4]"
            />
          </div>

          {/* 2. 전화번호 (tel) */}
          <div>
            <label
              htmlFor={phoneInputId}
              className="flex items-center gap-1 text-sm font-semibold text-[#5d4037] mb-1.5"
            >
              <Phone className="w-4 h-4 text-[#8d6e63]" />
              <span>전화번호</span>
              <span className="text-xs font-normal text-[#a1887f]">(선택)</span>
            </label>
            <input
              id={phoneInputId}
              type="tel"
              placeholder="연락처를 입력해주세요 (예: 010-1234-5678)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="cafe-input text-sm text-[#3e2723] placeholder:text-[#bcaaa4]"
            />
          </div>

          {/* 3. 음료 선택 (드롭다운) */}
          <div>
            <label
              htmlFor={drinkSelectId}
              className="flex items-center gap-1 text-sm font-semibold text-[#5d4037] mb-1.5"
            >
              <Coffee className="w-4 h-4 text-[#8d6e63]" />
              <span>음료 선택</span>
              <span className="text-red-500 font-bold" title="필수 선택">*</span>
            </label>
            <select
              id={drinkSelectId}
              value={selectedBeverageId}
              onChange={(e) => {
                setSelectedBeverageId(e.target.value);
                if (errorMessage && e.target.value) setErrorMessage(null);
              }}
              className="cafe-input text-sm text-[#3e2723] bg-white cursor-pointer"
            >
              <option value="">-- 음료를 선택해주세요 --</option>
              {BEVERAGES.map((beverage) => (
                <option key={beverage.id} value={beverage.id}>
                  {beverage.name} ({beverage.price.toLocaleString()}원)
                </option>
              ))}
            </select>
          </div>

          {/* 4. 사이즈 (라디오 버튼, 가로 배치) */}
          <div>
            <span className="block text-sm font-semibold text-[#5d4037] mb-2">
              사이즈 선택
            </span>
            <div className="flex flex-wrap items-center gap-3">
              {SIZES.map((size) => {
                const radioId = `size-${size.id}`;
                const isChecked = selectedSizeId === size.id;
                return (
                  <label
                    key={size.id}
                    htmlFor={radioId}
                    className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium cursor-pointer transition-all duration-150 select-none ${
                      isChecked
                        ? 'border-[#6b4226] bg-[#fbf5ef] text-[#6b4226] shadow-sm ring-1 ring-[#6b4226]'
                        : 'border-[#e0d6cb] bg-white text-[#5d4037] hover:bg-[#faf6f0]'
                    }`}
                  >
                    <input
                      id={radioId}
                      type="radio"
                      name="beverageSize"
                      value={size.id}
                      checked={isChecked}
                      onChange={() => setSelectedSizeId(size.id)}
                      className="accent-[#6b4226] w-4 h-4 cursor-pointer"
                    />
                    <span>{size.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 5. 추가 옵션 (체크박스, 가로 배치) */}
          <div>
            <span className="block text-sm font-semibold text-[#5d4037] mb-2">
              추가 옵션
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              {EXTRA_OPTIONS.map((option) => {
                const checkId = `option-${option.id}`;
                const isChecked = selectedOptions.includes(option.id);
                return (
                  <label
                    key={option.id}
                    htmlFor={checkId}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium cursor-pointer transition-all duration-150 select-none ${
                      isChecked
                        ? 'border-[#6b4226] bg-[#fbf5ef] text-[#6b4226] shadow-sm ring-1 ring-[#6b4226]'
                        : 'border-[#e0d6cb] bg-white text-[#5d4037] hover:bg-[#faf6f0]'
                    }`}
                  >
                    <input
                      id={checkId}
                      type="checkbox"
                      value={option.id}
                      checked={isChecked}
                      onChange={() => handleOptionToggle(option.id)}
                      className="accent-[#6b4226] w-4 h-4 rounded cursor-pointer"
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 6. 수량 (number 타입, 최소 1, 최대 10, 기본값 1) */}
          <div>
            <label
              htmlFor={quantityInputId}
              className="block text-sm font-semibold text-[#5d4037] mb-1.5"
            >
              수량 (1 ~ 10잔)
            </label>
            <div className="flex items-center gap-3">
              <input
                id={quantityInputId}
                type="number"
                min={1}
                max={10}
                value={quantity}
                onChange={handleQuantityChange}
                className="cafe-input text-sm text-[#3e2723] max-w-[130px] font-semibold text-center"
              />
              <span className="text-xs text-[#8d6e63]">
                * 1회 최대 10잔까지 주문 가능합니다.
              </span>
            </div>
          </div>

          {/* 7. 요청사항 (textarea) */}
          <div>
            <label
              htmlFor={requestTextareaId}
              className="flex items-center gap-1 text-sm font-semibold text-[#5d4037] mb-1.5"
            >
              <MessageSquare className="w-4 h-4 text-[#8d6e63]" />
              <span>요청사항</span>
              <span className="text-xs font-normal text-[#a1887f]">(선택)</span>
            </label>
            <textarea
              id={requestTextareaId}
              rows={3}
              placeholder="예: 덜 달게 해주세요, 얼음 적게 넣어주세요 등"
              value={specialRequest}
              onChange={(e) => setSpecialRequest(e.target.value)}
              className="cafe-input text-sm text-[#3e2723] placeholder:text-[#bcaaa4] resize-none"
            />
          </div>

          {/* ==========================================
              실시간 예상 금액 표시 영역
              - 주문하기 버튼 바로 위에 큰 글씨(24px), 갈색, 굵게, 가운데 정렬
             ========================================== */}
          <div className="pt-3 pb-1 border-t border-[#f0e4d7]">
            <div
              className="text-center font-bold text-[#6b4226] tracking-tight leading-snug py-2 bg-[#fdfaf7] rounded-xl border border-[#f2e7dc]"
              style={{ fontSize: '24px' }}
            >
              <span>예상 금액: </span>
              <span>{estimatedTotalPrice.toLocaleString()}원</span>
            </div>
            {!currentBeverage && (
              <p className="text-center text-xs text-[#a1887f] mt-1">
                * 음료를 선택하시면 정확한 금액이 계산됩니다.
              </p>
            )}
          </div>

          {/* ==========================================
              버튼 영역: 주문하기 버튼 및 다시 작성 버튼
             ========================================== */}
          <div className="space-y-2 pt-1">
            {/* 8. 주문하기 버튼: 갈색 배경(#6b4226), 흰색 글씨, hover시 약간 밝게 */}
            <button
              type="submit"
              className="cafe-btn-order w-full py-3.5 px-4 rounded-xl font-bold text-base shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <Coffee className="w-5 h-5" />
              <span>주문하기</span>
            </button>

            {/* 9. 다시 작성 버튼 */}
            <button
              type="button"
              onClick={handleReset}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-[#795548] bg-[#f5ede3] hover:bg-[#ebdcd0] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>다시 작성</span>
            </button>
          </div>

        </form>

        {/* ==========================================
            주문 확인 메시지 표시 영역
            - 연두색 배경, 초록 글씨, 둥근 모서리
           ========================================== */}
        {confirmationMessage && (
          <div className="p-6 pt-0">
            <div
              role="status"
              className="p-4 bg-[#e8f5e9] border border-[#c8e6c9] text-[#2e7d32] rounded-xl shadow-sm"
            >
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 flex-shrink-0 text-[#2e7d32] mt-0.5" />
                <div className="space-y-1">
                  <h3 className="font-bold text-base text-[#1b5e20]">
                    주문이 정상 접수되었습니다!
                  </h3>
                  <p className="text-sm font-medium leading-relaxed">
                    {confirmationMessage}
                  </p>
                  {phoneNumber && (
                    <p className="text-xs text-[#388e3c]">
                      안내 연락처: {phoneNumber}
                    </p>
                  )}
                  {specialRequest && (
                    <p className="text-xs text-[#388e3c] bg-white/70 p-2 rounded-lg mt-2 border border-[#c8e6c9]">
                      요청사항: {specialRequest}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 안내 팝업 배너 */}
        {noticeMessage && (
          <div className="mx-6 mb-4 p-3 bg-[#eef7ee] border border-[#b7dfb9] text-[#1b5e20] rounded-xl text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0 text-[#2e7d32]" />
            <span>{noticeMessage}</span>
          </div>
        )}

        {/* ==========================================
            자료 저장 및 엑셀 다운로드 관리 영역
           ========================================== */}
        <section className="bg-[#fcfaf7] border-t border-[#ebdcd0] p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[#6b4226]" />
              <h2 className="font-bold text-base text-[#6b4226]">
                주문 자료 저장 및 엑셀 내보내기
              </h2>
            </div>
            <span className="text-xs px-2 py-0.5 bg-[#f0e4d7] text-[#6b4226] font-semibold rounded-full">
              총 {savedOrders.length}건 저장됨
            </span>
          </div>

          <p className="text-xs text-[#8d6e63] mb-4 leading-relaxed">
            입력 및 클릭하여 주문한 모든 내역이 브라우저에 안전하게 보관되며, 아래 버튼을 눌러 실제 엑셀(.xlsx) 파일로 언제든 내려받을 수 있습니다.
          </p>

          {/* 엑셀 다운로드 버튼들 */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={exportToExcel}
              disabled={savedOrders.length === 0}
              className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                savedOrders.length > 0
                  ? 'bg-[#217346] hover:bg-[#1a5c37] text-white shadow-sm cursor-pointer active:scale-[0.99]'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>엑셀(.xlsx) 파일 저장하기</span>
            </button>

            {savedOrders.length > 0 && (
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget('all')}
                title="모든 저장 내역 초기화"
                className="px-3 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium cursor-pointer transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>비우기</span>
              </button>
            )}
          </div>

          {/* 저장된 주문 목록 보기 토글 */}
          {savedOrders.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between text-xs text-[#8d6e63] font-semibold py-2 px-1 hover:text-[#5d4037] cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5" />
                  저장된 주문 내역 목록 ({savedOrders.length}건)
                </span>
                {showHistory ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {/* 저장된 주문 목록 리스트 */}
              {showHistory && (
                <div className="space-y-2.5 mt-2 max-h-64 overflow-y-auto pr-1">
                  {savedOrders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-white p-3 rounded-xl border border-[#ebdcd0] text-xs shadow-2xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[#8d6e63]">
                        <span className="font-mono text-[11px] font-semibold text-[#6b4226]">
                          {order.orderNumber}
                        </span>
                        <div className="flex items-center gap-2">
                          <span>{order.orderDate}</span>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmTarget(order.id)}
                            className="text-stone-400 hover:text-red-500 cursor-pointer transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between">
                        <span className="font-bold text-sm text-[#3e2723]">
                          {order.customerName} 고객님
                        </span>
                        <span className="font-bold text-sm text-[#6b4226]">
                          {order.totalPrice.toLocaleString()}원
                        </span>
                      </div>

                      <div className="bg-[#faf6f0] p-2 rounded-lg text-[#5d4037] flex flex-wrap gap-x-2 gap-y-1">
                        <span className="font-semibold">{order.beverageName}</span>
                        <span>&bull;</span>
                        <span>{order.sizeName}</span>
                        <span>&bull;</span>
                        <span>옵션: {order.options}</span>
                        <span>&bull;</span>
                        <span>{order.quantity}잔</span>
                      </div>

                      {order.specialRequest && order.specialRequest !== '없음' && (
                        <p className="text-[11px] text-[#8d6e63] italic">
                          요청사항: {order.specialRequest}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {savedOrders.length === 0 && (
            <div className="p-4 text-center bg-white rounded-xl border border-dashed border-[#ebdcd0] text-xs text-[#a1887f]">
              아직 저장된 주문 자료가 없습니다.<br />주문서를 작성하고 주문하기를 누르면 이곳에 자동 보관됩니다.
            </div>
          )}
        </section>

        {/* 삭제 확인 모달 다이얼로그 (window.confirm 대체) */}
        {deleteConfirmTarget && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-5 max-w-xs w-full shadow-2xl border border-stone-200 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-[#3e2723]">
                  {deleteConfirmTarget === 'all' ? '전체 내역 삭제' : '주문 기록 삭제'}
                </h3>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmTarget(null)}
                  className="text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                {deleteConfirmTarget === 'all'
                  ? '저장된 모든 주문 자료를 삭제하시겠습니까? 삭제된 자료는 복구할 수 없습니다.'
                  : '선택하신 주문 기록을 삭제하시겠습니까?'}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmTarget(null)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={executeDelete}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                >
                  삭제하기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 푸터 영역 */}
        <footer className="py-4 px-6 bg-[#faf6f0] border-t border-[#ebdcd0] text-center text-xs text-[#a1887f]">
          바이브 카페 (Vibe Cafe) &bull; 정성을 담은 한 잔을 준비합니다.
        </footer>
      </div>
    </div>
  );
}
