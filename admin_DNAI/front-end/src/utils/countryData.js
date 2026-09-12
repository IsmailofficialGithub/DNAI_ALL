// Country data with flags (emoji) and phone codes
// export const countries = [
//   { name: "Afghanistan", code: "AF", flag: "🇦🇫", phoneCode: "+93", totalLength: 12 },
//   { name: "Albania", code: "AL", flag: "🇦🇱", phoneCode: "+355", totalLength: 12 },
//   { name: "Algeria", code: "DZ", flag: "🇩🇿", phoneCode: "+213", totalLength: 12 },
//   { name: "Andorra", code: "AD", flag: "🇦🇩", phoneCode: "+376", totalLength: 12 },
//   { name: "Angola", code: "AO", flag: "🇦🇴", phoneCode: "+244", totalLength: 12 },
//   { name: "Antigua and Barbuda", code: "AG", flag: "🇦🇬", phoneCode: "+1-268", totalLength: 11 },
//   { name: "Argentina", code: "AR", flag: "🇦🇷", phoneCode: "+54", totalLength: 13 },
//   { name: "Armenia", code: "AM", flag: "🇦🇲", phoneCode: "+374", totalLength: 11 },
//   { name: "Australia", code: "AU", flag: "🇦🇺", phoneCode: "+61", totalLength: 11 },
//   { name: "Austria", code: "AT", flag: "🇦🇹", phoneCode: "+43", totalLength: 13 },
//   { name: "Azerbaijan", code: "AZ", flag: "🇦🇿", phoneCode: "+994", totalLength: 12 },
//   { name: "Bahamas", code: "BS", flag: "🇧🇸", phoneCode: "+1-242", totalLength: 11 },
//   { name: "Bahrain", code: "BH", flag: "🇧🇭", phoneCode: "+973", totalLength: 11 },
//   { name: "Bangladesh", code: "BD", flag: "🇧🇩", phoneCode: "+880", totalLength: 13 },
//   { name: "Barbados", code: "BB", flag: "🇧🇧", phoneCode: "+1-246", totalLength: 11 },
//   { name: "Belarus", code: "BY", flag: "🇧🇾", phoneCode: "+375", totalLength: 12 },
//   { name: "Belgium", code: "BE", flag: "🇧🇪", phoneCode: "+32", totalLength: 12 },
//   { name: "Belize", code: "BZ", flag: "🇧🇿", phoneCode: "+501", totalLength: 11 },
//   { name: "Benin", code: "BJ", flag: "🇧🇯", phoneCode: "+229", totalLength: 12 },
//   { name: "Bhutan", code: "BT", flag: "🇧🇹", phoneCode: "+975", totalLength: 11 },
//   { name: "Bolivia", code: "BO", flag: "🇧🇴", phoneCode: "+591", totalLength: 12 },
//   { name: "Bosnia and Herzegovina", code: "BA", flag: "🇧🇦", phoneCode: "+387", totalLength: 12 },
//   { name: "Botswana", code: "BW", flag: "🇧🇼", phoneCode: "+267", totalLength: 11 },
//   { name: "Brazil", code: "BR", flag: "🇧🇷", phoneCode: "+55", totalLength: 13 },
//   { name: "Brunei", code: "BN", flag: "🇧🇳", phoneCode: "+673", totalLength: 11 },
//   { name: "Bulgaria", code: "BG", flag: "🇧🇬", phoneCode: "+359", totalLength: 13 },
//   { name: "Burkina Faso", code: "BF", flag: "🇧🇫", phoneCode: "+226", totalLength: 12 },
//   { name: "Burundi", code: "BI", flag: "🇧🇮", phoneCode: "+257", totalLength: 11 },
//   { name: "Cabo Verde", code: "CV", flag: "🇨🇻", phoneCode: "+238", totalLength: 11 },
//   { name: "Cambodia", code: "KH", flag: "🇰🇭", phoneCode: "+855", totalLength: 12 },
//   { name: "Cameroon", code: "CM", flag: "🇨🇲", phoneCode: "+237", totalLength: 12 },
//   { name: "Canada", code: "CA", flag: "🇨🇦", phoneCode: "+1", totalLength: 11 },
//   { name: "Central African Republic", code: "CF", flag: "🇨🇫", phoneCode: "+236", totalLength: 11 },
//   { name: "Chad", code: "TD", flag: "🇹🇩", phoneCode: "+235", totalLength: 11 },
//   { name: "Chile", code: "CL", flag: "🇨🇱", phoneCode: "+56", totalLength: 12 },
//   { name: "China", code: "CN", flag: "🇨🇳", phoneCode: "+86", totalLength: 13 },
//   { name: "Colombia", code: "CO", flag: "🇨🇴", phoneCode: "+57", totalLength: 13 },
//   { name: "Comoros", code: "KM", flag: "🇰🇲", phoneCode: "+269", totalLength: 11 },
//   { name: "Congo (Democratic Rep. of the)", code: "CD", flag: "🇨🇩", phoneCode: "+243", totalLength: 12 },
//   { name: "Congo (Rep. of the)", code: "CG", flag: "🇨🇬", phoneCode: "+242", totalLength: 11 },
//   { name: "Costa Rica", code: "CR", flag: "🇨🇷", phoneCode: "+506", totalLength: 11 },
//   { name: "Côte d'Ivoire", code: "CI", flag: "🇨🇮", phoneCode: "+225", totalLength: 12 },
//   { name: "Croatia", code: "HR", flag: "🇭🇷", phoneCode: "+385", totalLength: 12 },
//   { name: "Cuba", code: "CU", flag: "🇨🇺", phoneCode: "+53", totalLength: 12 },
//   { name: "Cyprus", code: "CY", flag: "🇨🇾", phoneCode: "+357", totalLength: 10 },
//   { name: "Czechia (Czech Republic)", code: "CZ", flag: "🇨🇿", phoneCode: "+420", totalLength: 13 },
//   { name: "Denmark", code: "DK", flag: "🇩🇰", phoneCode: "+45", totalLength: 11 },
//   { name: "Djibouti", code: "DJ", flag: "🇩🇯", phoneCode: "+253", totalLength: 11 },
//   { name: "Dominica", code: "DM", flag: "🇩🇲", phoneCode: "+1-767", totalLength: 11 },
//   { name: "Dominican Republic", code: "DO", flag: "🇩🇴", phoneCode: "+1-809, +1-829, +1-849", totalLength: 11 },
//   { name: "Ecuador", code: "EC", flag: "🇪🇨", phoneCode: "+593", totalLength: 12 },
//   { name: "Egypt", code: "EG", flag: "🇪🇬", phoneCode: "+20", totalLength: 12 },
//   { name: "El Salvador", code: "SV", flag: "🇸🇻", phoneCode: "+503", totalLength: 11 },
//   { name: "Equatorial Guinea", code: "GQ", flag: "🇬🇶", phoneCode: "+240", totalLength: 12 },
//   { name: "Eritrea", code: "ER", flag: "🇪🇷", phoneCode: "+291", totalLength: 11 },
//   { name: "Estonia", code: "EE", flag: "🇪🇪", phoneCode: "+372", totalLength: 12 },
//   { name: "Eswatini", code: "SZ", flag: "🇸🇿", phoneCode: "+268", totalLength: 11 },
//   { name: "Ethiopia", code: "ET", flag: "🇪🇹", phoneCode: "+251", totalLength: 12 },
//   { name: "Fiji", code: "FJ", flag: "🇫🇯", phoneCode: "+679", totalLength: 10 },
//   { name: "Finland", code: "FI", flag: "🇫🇮", phoneCode: "+358", totalLength: 12 },
//   { name: "France", code: "FR", flag: "🇫🇷", phoneCode: "+33", totalLength: 11 },
//   { name: "Gabon", code: "GA", flag: "🇬🇦", phoneCode: "+241", totalLength: 11 },
//   { name: "Gambia", code: "GM", flag: "🇬🇲", phoneCode: "+220", totalLength: 10 },
//   { name: "Georgia", code: "GE", flag: "🇬🇪", phoneCode: "+995", totalLength: 12 },
//   { name: "Germany", code: "DE", flag: "🇩🇪", phoneCode: "+49", totalLength: 13 },
//   { name: "Ghana", code: "GH", flag: "🇬🇭", phoneCode: "+233", totalLength: 12 },
//   { name: "Greece", code: "GR", flag: "🇬🇷", phoneCode: "+30", totalLength: 13 },
//   { name: "Grenada", code: "GD", flag: "🇬🇩", phoneCode: "+1-473", totalLength: 11 },
//   { name: "Guatemala", code: "GT", flag: "🇬🇹", phoneCode: "+502", totalLength: 11 },
//   { name: "Guinea", code: "GN", flag: "🇬🇳", phoneCode: "+224", totalLength: 11 },
//   { name: "Guinea-Bissau", code: "GW", flag: "🇬🇼", phoneCode: "+245", totalLength: 10 },
//   { name: "Guyana", code: "GY", flag: "🇬🇾", phoneCode: "+592", totalLength: 10 },
//   { name: "Haiti", code: "HT", flag: "🇭🇹", phoneCode: "+509", totalLength: 11 },
//   { name: "Holy See (Vatican City)", code: "VA", flag: "🇻🇦", phoneCode: "+379", totalLength: 9 },
//   { name: "Honduras", code: "HN", flag: "🇭🇳", phoneCode: "+504", totalLength: 12 },
//   { name: "Hungary", code: "HU", flag: "🇭🇺", phoneCode: "+36", totalLength: 11 },
//   { name: "Iceland", code: "IS", flag: "🇮🇸", phoneCode: "+354", totalLength: 11 },
//   { name: "India", code: "IN", flag: "🇮🇳", phoneCode: "+91", totalLength: 12 },
//   { name: "Indonesia", code: "ID", flag: "🇮🇩", phoneCode: "+62", totalLength: 12 },
//   { name: "Iran", code: "IR", flag: "🇮🇷", phoneCode: "+98", totalLength: 12 },
//   { name: "Iraq", code: "IQ", flag: "🇮🇶", phoneCode: "+964", totalLength: 13 },
//   { name: "Ireland", code: "IE", flag: "🇮🇪", phoneCode: "+353", totalLength: 12 },
//   { name: "Israel", code: "IL", flag: "🇮🇱", phoneCode: "+972", totalLength: 13 },
//   { name: "Italy", code: "IT", flag: "🇮🇹", phoneCode: "+39", totalLength: 13 },
//   { name: "Jamaica", code: "JM", flag: "🇯🇲", phoneCode: "+1-876", totalLength: 11 },
//   { name: "Japan", code: "JP", flag: "🇯🇵", phoneCode: "+81", totalLength: 12 },
//   { name: "Jordan", code: "JO", flag: "🇯🇴", phoneCode: "+962", totalLength: 12 },
//   { name: "Kazakhstan", code: "KZ", flag: "🇰🇿", phoneCode: "+7", totalLength: 11 },
//   { name: "Kenya", code: "KE", flag: "🇰🇪", phoneCode: "+254", totalLength: 12 },
//   { name: "Kiribati", code: "KI", flag: "🇰🇮", phoneCode: "+686", totalLength: 8 },
//   { name: "Korea (DPR - North)", code: "KP", flag: "🇰🇵", phoneCode: "+850", totalLength: 11 },
//   { name: "Korea (Republic of - South)", code: "KR", flag: "🇰🇷", phoneCode: "+82", totalLength: 11 },
//   { name: "Kuwait", code: "KW", flag: "🇰🇼", phoneCode: "+965", totalLength: 11 },
//   { name: "Kyrgyzstan", code: "KG", flag: "🇰🇬", phoneCode: "+996", totalLength: 12 },
//   { name: "Laos", code: "LA", flag: "🇱🇦", phoneCode: "+856", totalLength: 10 },
//   { name: "Latvia", code: "LV", flag: "🇱🇻", phoneCode: "+371", totalLength: 11 },
//   { name: "Lebanon", code: "LB", flag: "🇱🇧", phoneCode: "+961", totalLength: 11 },
//   { name: "Lesotho", code: "LS", flag: "🇱🇸", phoneCode: "+266", totalLength: 12 },
//   { name: "Liberia", code: "LR", flag: "🇱🇷", phoneCode: "+231", totalLength: 11 },
//   { name: "Libya", code: "LY", flag: "🇱🇾", phoneCode: "+218", totalLength: 12 },
//   { name: "Liechtenstein", code: "LI", flag: "🇱🇮", phoneCode: "+423", totalLength: 12 },
//   { name: "Lithuania", code: "LT", flag: "🇱🇹", phoneCode: "+370", totalLength: 12 },
//   { name: "Luxembourg", code: "LU", flag: "🇱🇺", phoneCode: "+352", totalLength: 12 },
//   { name: "Madagascar", code: "MG", flag: "🇲🇬", phoneCode: "+261", totalLength: 12 },
//   { name: "Malawi", code: "MW", flag: "🇲🇼", phoneCode: "+265", totalLength: 12 },
//   { name: "Malaysia", code: "MY", flag: "🇲🇾", phoneCode: "+60", totalLength: 11 },
//   { name: "Maldives", code: "MV", flag: "🇲🇻", phoneCode: "+960", totalLength: 10 },
//   { name: "Mali", code: "ML", flag: "🇲🇱", phoneCode: "+223", totalLength: 11 },
//   { name: "Malta", code: "MT", flag: "🇲🇹", phoneCode: "+356", totalLength: 11 },
//   { name: "Marshall Islands", code: "MH", flag: "🇲🇭", phoneCode: "+692", totalLength: 7 },
//   { name: "Mauritania", code: "MR", flag: "🇲🇷", phoneCode: "+222", totalLength: 11 },
//   { name: "Mauritius", code: "MU", flag: "🇲🇺", phoneCode: "+230", totalLength: 10 },
//   { name: "Mexico", code: "MX", flag: "🇲🇽", phoneCode: "+52", totalLength: 13 },
//   { name: "Micronesia (Federated States of)", code: "FM", flag: "🇫🇲", phoneCode: "+691", totalLength: 7 },
//   { name: "Moldova", code: "MD", flag: "🇲🇩", phoneCode: "+373", totalLength: 12 },
//   { name: "Monaco", code: "MC", flag: "🇲🇨", phoneCode: "+377", totalLength: 11 },
//   { name: "Mongolia", code: "MN", flag: "🇲🇳", phoneCode: "+976", totalLength: 12 },
//   { name: "Montenegro", code: "ME", flag: "🇲🇪", phoneCode: "+382", totalLength: 12 },
//   { name: "Morocco", code: "MA", flag: "🇲🇦", phoneCode: "+212", totalLength: 12 },
//   { name: "Mozambique", code: "MZ", flag: "🇲🇿", phoneCode: "+258", totalLength: 12 },
//   { name: "Myanmar", code: "MM", flag: "🇲🇲", phoneCode: "+95", totalLength: 11 },
//   { name: "Namibia", code: "NA", flag: "🇳🇦", phoneCode: "+264", totalLength: 11 },
//   { name: "Nauru", code: "NR", flag: "🇳🇷", phoneCode: "+674", totalLength: 7 },
//   { name: "Nepal", code: "NP", flag: "🇳🇵", phoneCode: "+977", totalLength: 10 },
//   { name: "Netherlands", code: "NL", flag: "🇳🇱", phoneCode: "+31", totalLength: 11 },
//   { name: "New Zealand", code: "NZ", flag: "🇳🇿", phoneCode: "+64", totalLength: 11 },
//   { name: "Nicaragua", code: "NI", flag: "🇳🇮", phoneCode: "+505", totalLength: 12 },
//   { name: "Niger", code: "NE", flag: "🇳🇪", phoneCode: "+227", totalLength: 11 },
//   { name: "Nigeria", code: "NG", flag: "🇳🇬", phoneCode: "+234", totalLength: 13 },
//   { name: "North Macedonia", code: "MK", flag: "🇲🇰", phoneCode: "+389", totalLength: 12 },
//   { name: "Norway", code: "NO", flag: "🇳🇴", phoneCode: "+47", totalLength: 10 },
//   { name: "Oman", code: "OM", flag: "🇴🇲", phoneCode: "+968", totalLength: 11 },
//   { name: "Pakistan", code: "PK", flag: "🇵🇰", phoneCode: "+92", totalLength: 12 },
//   { name: "Palau", code: "PW", flag: "🇵🇼", phoneCode: "+680", totalLength: 7 },
//   { name: "Palestine", code: "PS", flag: "🇵🇸", phoneCode: "+970", totalLength: 12 },
//   { name: "Panama", code: "PA", flag: "🇵🇦", phoneCode: "+507", totalLength: 11 },
//   { name: "Papua New Guinea", code: "PG", flag: "🇵🇬", phoneCode: "+675", totalLength: 11 },
//   { name: "Paraguay", code: "PY", flag: "🇵🇾", phoneCode: "+595", totalLength: 12 },
//   { name: "Peru", code: "PE", flag: "🇵🇪", phoneCode: "+51", totalLength: 12 },
//   { name: "Philippines", code: "PH", flag: "🇵🇭", phoneCode: "+63", totalLength: 12 },
//   { name: "Poland", code: "PL", flag: "🇵🇱", phoneCode: "+48", totalLength: 12 },
//   { name: "Portugal", code: "PT", flag: "🇵🇹", phoneCode: "+351", totalLength: 12 },
//   { name: "Qatar", code: "QA", flag: "🇶🇦", phoneCode: "+974", totalLength: 11 },
//   { name: "Romania", code: "RO", flag: "🇷🇴", phoneCode: "+40", totalLength: 12 },
//   { name: "Russia", code: "RU", flag: "🇷🇺", phoneCode: "+7", totalLength: 11 },
//   { name: "Rwanda", code: "RW", flag: "🇷🇼", phoneCode: "+250", totalLength: 12 },
//   { name: "Saint Kitts and Nevis", code: "KN", flag: "🇰🇳", phoneCode: "+1-869", totalLength: 11 },
//   { name: "Saint Lucia", code: "LC", flag: "🇱🇨", phoneCode: "+1-758", totalLength: 11 },
//   { name: "Saint Vincent and the Grenadines", code: "VC", flag: "🇻🇨", phoneCode: "+1-784", totalLength: 11 },
//   { name: "Samoa", code: "WS", flag: "🇼🇸", phoneCode: "+685", totalLength: 8 },
//   { name: "San Marino", code: "SM", flag: "🇸🇲", phoneCode: "+378", totalLength: 10 },
//   { name: "Sao Tome and Principe", code: "ST", flag: "🇸🇹", phoneCode: "+239", totalLength: 9 },
//   { name: "Saudi Arabia", code: "SA", flag: "🇸🇦", phoneCode: "+966", totalLength: 12 },
//   { name: "Senegal", code: "SN", flag: "🇸🇳", phoneCode: "+221", totalLength: 12 },
//   { name: "Serbia", code: "RS", flag: "🇷🇸", phoneCode: "+381", totalLength: 12 },
//   { name: "Seychelles", code: "SC", flag: "🇸🇨", phoneCode: "+248", totalLength: 10 },
//   { name: "Sierra Leone", code: "SL", flag: "🇸🇱", phoneCode: "+232", totalLength: 11 },
//   { name: "Singapore", code: "SG", flag: "🇸🇬", phoneCode: "+65", totalLength: 10 },
//   { name: "Slovakia", code: "SK", flag: "🇸🇰", phoneCode: "+421", totalLength: 12 },
//   { name: "Slovenia", code: "SI", flag: "🇸🇮", phoneCode: "+386", totalLength: 11 },
//   { name: "Solomon Islands", code: "SB", flag: "🇸🇧", phoneCode: "+677", totalLength: 10 },
//   { name: "Somalia", code: "SO", flag: "🇸🇴", phoneCode: "+252", totalLength: 9 },
//   { name: "South Africa", code: "ZA", flag: "🇿🇦", phoneCode: "+27", totalLength: 11 },
//   { name: "South Sudan", code: "SS", flag: "🇸🇸", phoneCode: "+211", totalLength: 12 },
//   { name: "Spain", code: "ES", flag: "🇪🇸", phoneCode: "+34", totalLength: 12 },
//   { name: "Sri Lanka", code: "LK", flag: "🇱🇰", phoneCode: "+94", totalLength: 11 },
//   { name: "Sudan", code: "SD", flag: "🇸🇩", phoneCode: "+249", totalLength: 12 },
//   { name: "Suriname", code: "SR", flag: "🇸🇷", phoneCode: "+597", totalLength: 11 },
//   { name: "Sweden", code: "SE", flag: "🇸🇪", phoneCode: "+46", totalLength: 12 },
//   { name: "Switzerland", code: "CH", flag: "🇨🇭", phoneCode: "+41", totalLength: 11 },
//   { name: "Syria", code: "SY", flag: "🇸🇾", phoneCode: "+963", totalLength: 12 },
//   { name: "Tajikistan", code: "TJ", flag: "🇹🇯", phoneCode: "+992", totalLength: 12 },
//   { name: "Tanzania", code: "TZ", flag: "🇹🇿", phoneCode: "+255", totalLength: 12 },
//   { name: "Thailand", code: "TH", flag: "🇹🇭", phoneCode: "+66", totalLength: 11 },
//   { name: "Timor-Leste", code: "TL", flag: "🇹🇱", phoneCode: "+670", totalLength: 9 },
//   { name: "Togo", code: "TG", flag: "🇹🇬", phoneCode: "+228", totalLength: 10 },
//   { name: "Tonga", code: "TO", flag: "🇹🇴", phoneCode: "+676", totalLength: 10 },
//   { name: "Trinidad and Tobago", code: "TT", flag: "🇹🇹", phoneCode: "+1-868", totalLength: 11 },
//   { name: "Tunisia", code: "TN", flag: "🇹🇳", phoneCode: "+216", totalLength: 12 },
//   { name: "Turkey", code: "TR", flag: "🇹🇷", phoneCode: "+90", totalLength: 12 },
//   { name: "Turkmenistan", code: "TM", flag: "🇹🇲", phoneCode: "+993", totalLength: 11 },
//   { name: "Tuvalu", code: "TV", flag: "🇹🇻", phoneCode: "+688", totalLength: 7 },
//   { name: "Uganda", code: "UG", flag: "🇺🇬", phoneCode: "+256", totalLength: 12 },
//   { name: "Ukraine", code: "UA", flag: "🇺🇦", phoneCode: "+380", totalLength: 12 },
//   { name: "United Arab Emirates (UAE)", code: "AE", flag: "🇦🇪", phoneCode: "+971", totalLength: 12 },
//   { name: "United Kingdom", code: "GB", flag: "🇬🇧", phoneCode: "+44", totalLength: 12 },
//   { name: "United States", code: "US", flag: "🇺🇸", phoneCode: "+1", totalLength: 11 },
//   { name: "Uruguay", code: "UY", flag: "🇺🇾", phoneCode: "+598", totalLength: 11 },
//   { name: "Uzbekistan", code: "UZ", flag: "🇺🇿", phoneCode: "+998", totalLength: 12 },
//   { name: "Vanuatu", code: "VU", flag: "🇻🇺", phoneCode: "+678", totalLength: 7 },
//   { name: "Venezuela", code: "VE", flag: "🇻🇪", phoneCode: "+58", totalLength: 12 },
//   { name: "Vietnam", code: "VN", flag: "🇻🇳", phoneCode: "+84", totalLength: 11 },
//   { name: "Yemen", code: "YE", flag: "🇾🇪", phoneCode: "+967", totalLength: 11 },
//   { name: "Zambia", code: "ZM", flag: "🇿🇲", phoneCode: "+260", totalLength: 10 },
//   { name: "Zimbabwe", code: "ZW", flag: "🇿🇼", phoneCode: "+263", totalLength: 10 },
//   { name: "Taiwan (ROC)", code: "TW", flag: "🇹🇼", phoneCode: "+886", totalLength: 12 },
//   { name: "Kosovo", code: "XK", flag: "🇽🇰", phoneCode: "+383", totalLength: 12 },
//   { name: "Western Sahara (SADR)", code: "EH", flag: "🇪🇭", phoneCode: "+212", totalLength: 12 },
//   { name: "Abkhazia", code: "AB", flag: "🇦🇧", phoneCode: "+995", totalLength: 12 },
//   { name: "South Ossetia", code: "OS", flag: "🇴🇸", phoneCode: "+995", totalLength: 12 },
//   { name: "Northern Cyprus (TRNC)", code: "NC", flag: "🇹🇷", phoneCode: "+90", totalLength: 12 },
//   { name: "Somaliland", code: "SO", flag: "🇸🇴", phoneCode: "+252", totalLength: 9 },
//   { name: "Cook Islands", code: "CK", flag: "🇨🇰", phoneCode: "+682", totalLength: 7 },
//   { name: "Puerto Rico", code: "PR", flag: "🇵🇷", phoneCode: "+1-787", totalLength: 11 },
//   { name: "Hong Kong", code: "HK", flag: "🇭🇰", phoneCode: "+852", totalLength: 11 },
//   { name: "Macao", code: "MO", flag: "🇲🇴", phoneCode: "+853", totalLength: 10 },
//   { name: "Guernsey", code: "GG", flag: "🇬🇬", phoneCode: "+44-1481", totalLength: 12 },
//   { name: "Jersey", code: "JE", flag: "🇯🇪", phoneCode: "+44-1534", totalLength: 12 },
//   { name: "Isle of Man", code: "IM", flag: "🇮🇲", phoneCode: "+44-1624", totalLength: 12 },
//   { name: "Gibraltar", code: "GI", flag: "🇬🇮", phoneCode: "+350", totalLength: 9 },
//   { name: "Cayman Islands", code: "KY", flag: "🇰🇾", phoneCode: "+1-345", totalLength: 11 },
//   { name: "Bermuda", code: "BM", flag: "🇧🇲", phoneCode: "+1-441", totalLength: 11 },
//   { name: "Greenland", code: "GL", flag: "🇬🇱", phoneCode: "+299", totalLength: 10 },
//   { name: "Curaçao", code: "CW", flag: "🇨🇼", phoneCode: "+599", totalLength: 10 },
//   { name: "Aruba", code: "AW", flag: "🇦🇼", phoneCode: "+297", totalLength: 10 }
// ];
export const countries = [
  // Country: Afghanistan (+93) - National: 9 - Total Chars: 12
  { name: "Afghanistan", code: "AF", flag: "🇦🇫", phoneCode: "+93", nationalLength: 9, totalLength: 12 },
  // Country: Albania (+355) - National: 9 - Total Chars: 13
  { name: "Albania", code: "AL", flag: "🇦🇱", phoneCode: "+355", nationalLength: 9, totalLength: 13 },
  // Country: Algeria (+213) - National: 9 - Total Chars: 13
  { name: "Algeria", code: "DZ", flag: "🇩🇿", phoneCode: "+213", nationalLength: 9, totalLength: 13 },
  // Country: American Samoa (+1) - National: 10 - Total Chars: 12
  { name: "American Samoa", code: "AS", flag: "🇦🇸", phoneCode: "+1", nationalLength: 10, totalLength: 12 },
  // Country: Andorra (+376) - National: 9 - Total Chars: 13
  { name: "Andorra", code: "AD", flag: "🇦🇩", phoneCode: "+376", nationalLength: 9, totalLength: 13 },
  // Country: Angola (+244) - National: 9 - Total Chars: 13
  { name: "Angola", code: "AO", flag: "🇦🇴", phoneCode: "+244", nationalLength: 9, totalLength: 13 },
  // Country: Anguilla (+1) - National: 10 - Total Chars: 12
  { name: "Anguilla", code: "AI", flag: "🇦🇮", phoneCode: "+1", nationalLength: 10, totalLength: 12 },
  // Country: Antigua and Barbuda (+1) - National: 10 - Total Chars: 12
  { name: "Antigua and Barbuda", code: "AG", flag: "🇦🇬", phoneCode: "+1", nationalLength: 10, totalLength: 12 },
  // Country: Argentina (+54) - National: 10 - Total Chars: 13
  { name: "Argentina", code: "AR", flag: "🇦🇷", phoneCode: "+54", nationalLength: 10, totalLength: 13 },
  // Country: Armenia (+374) - National: 8 - Total Chars: 12
  { name: "Armenia", code: "AM", flag: "🇦🇲", phoneCode: "+374", nationalLength: 8, totalLength: 12 },
  // Country: Aruba (+297) - National: 7 - Total Chars: 11
  { name: "Aruba", code: "AW", flag: "🇦🇼", phoneCode: "+297", nationalLength: 7, totalLength: 11 },
  // Country: Australia (+61) - National: 9 - Total Chars: 12
  { name: "Australia", code: "AU", flag: "🇦🇺", phoneCode: "+61", nationalLength: 9, totalLength: 12 },
  // Country: Austria (+43) - National: 13 - Total Chars: 16
  { name: "Austria", code: "AT", flag: "🇦🇹", phoneCode: "+43", nationalLength: 13, totalLength: 16 },
  // Country: Azerbaijan (+994) - National: 9 - Total Chars: 13
  { name: "Azerbaijan", code: "AZ", flag: "🇦🇿", phoneCode: "+994", nationalLength: 9, totalLength: 13 },
  // Country: Bahamas (+1) - National: 10 - Total Chars: 12
  { name: "Bahamas", code: "BS", flag: "🇧🇸", phoneCode: "+1", nationalLength: 10, totalLength: 12 },
  // Country: Bahrain (+973) - National: 8 - Total Chars: 12
  { name: "Bahrain", code: "BH", flag: "🇧🇭", phoneCode: "+973", nationalLength: 8, totalLength: 12 },
  // Country: Bangladesh (+880) - National: 10 - Total Chars: 14
  { name: "Bangladesh", code: "BD", flag: "🇧🇩", phoneCode: "+880", nationalLength: 10, totalLength: 14 },
  // Country: Barbados (+1) - National: 10 - Total Chars: 12
  { name: "Barbados", code: "BB", flag: "🇧🇧", phoneCode: "+1", nationalLength: 10, totalLength: 12 },
  // Country: Belarus (+375) - National: 9 - Total Chars: 13
  { name: "Belarus", code: "BY", flag: "🇧🇾", phoneCode: "+375", nationalLength: 9, totalLength: 13 },
  // Country: Belgium (+32) - National: 9 - Total Chars: 12
  { name: "Belgium", code: "BE", flag: "🇧🇪", phoneCode: "+32", nationalLength: 9, totalLength: 12 },
  // Country: Belize (+501) - National: 7 - Total Chars: 11
  { name: "Belize", code: "BZ", flag: "🇧🇿", phoneCode: "+501", nationalLength: 7, totalLength: 11 },
  // Country: Benin (+229) - National: 8 - Total Chars: 12
  { name: "Benin", code: "BJ", flag: "🇧🇯", phoneCode: "+229", nationalLength: 8, totalLength: 12 },
  // Country: Bermuda (+1) - National: 10 - Total Chars: 12
  { name: "Bermuda", code: "BM", flag: "🇧🇲", phoneCode: "+1", nationalLength: 10, totalLength: 12 },
  // Country: Bhutan (+975) - National: 8 - Total Chars: 12
  { name: "Bhutan", code: "BT", flag: "🇧🇹", phoneCode: "+975", nationalLength: 8, totalLength: 12 },
  // Country: Bolivia (+591) - National: 8 - Total Chars: 12
  { name: "Bolivia", code: "BO", flag: "🇧🇴", phoneCode: "+591", nationalLength: 8, totalLength: 12 },
  // Country: Bosnia and Herzegovina (+387) - National: 9 - Total Chars: 13
  { name: "Bosnia and Herzegovina", code: "BA", flag: "🇧🇦", phoneCode: "+387", nationalLength: 9, totalLength: 13 },
  // Country: Botswana (+267) - National: 8 - Total Chars: 12
  { name: "Botswana", code: "BW", flag: "🇧🇼", phoneCode: "+267", nationalLength: 8, totalLength: 12 },
  // Country: Brazil (+55) - National: 11 - Total Chars: 14
  { name: "Brazil", code: "BR", flag: "🇧🇷", phoneCode: "+55", nationalLength: 11, totalLength: 14 },
  // Country: British Indian Ocean Territory (+246) - National: 7 - Total Chars: 11
  { name: "British Indian Ocean Territory", code: "IO", flag: "🇮🇴", phoneCode: "+246", nationalLength: 7, totalLength: 11 },
  // Country: British Virgin Islands (+1) - National: 10 - Total Chars: 12
  { name: "British Virgin Islands", code: "VG", flag: "🇻🇬", phoneCode: "+1", nationalLength: 10, totalLength: 12 },
  // Country: Brunei (+673) - National: 7 - Total Chars: 11
  { name: "Brunei", code: "BN", flag: "🇧🇳", phoneCode: "+673", nationalLength: 7, totalLength: 11 },
  // Country: Bulgaria (+359) - National: 9 - Total Chars: 13
  { name: "Bulgaria", code: "BG", flag: "🇧🇬", phoneCode: "+359", nationalLength: 9, totalLength: 13 },
  // Country: Burkina Faso (+226) - National: 8 - Total Chars: 12
  { name: "Burkina Faso", code: "BF", flag: "🇧🇫", phoneCode: "+226", nationalLength: 8, totalLength: 12 },
  // Country: Burundi (+257) - National: 8 - Total Chars: 12
  { name: "Burundi", code: "BI", flag: "🇧🇮", phoneCode: "+257", nationalLength: 8, totalLength: 12 },
  // Country: Cambodia (+855) - National: 9 - Total Chars: 13
  { name: "Cambodia", code: "KH", flag: "🇰🇭", phoneCode: "+855", nationalLength: 9, totalLength: 13 },
  // Country: Cameroon (+237) - National: 9 - Total Chars: 13
  { name: "Cameroon", code: "CM", flag: "🇨🇲", phoneCode: "+237", nationalLength: 9, totalLength: 13 },
  // Country: Canada (+1) - National: 10 - Total Chars: 12
  { name: "Canada", code: "CA", flag: "🇨🇦", phoneCode: "+1", nationalLength: 10, totalLength: 12 },
  // Country: Cape Verde (+238) - National: 7 - Total Chars: 11
  { name: "Cape Verde", code: "CV", flag: "🇨🇻", phoneCode: "+238", nationalLength: 7, totalLength: 11 },
  // Country: Cayman Islands (+1) - National: 10 - Total Chars: 12
  { name: "Cayman Islands", code: "KY", flag: "🇰🇾", phoneCode: "+1", nationalLength: 10, totalLength: 12 },
  // Country: Central African Republic (+236) - National: 8 - Total Chars: 12
  { name: "Central African Republic", code: "CF", flag: "🇨🇫", phoneCode: "+236", nationalLength: 8, totalLength: 12 },
  // Country: Chad (+235) - National: 8 - Total Chars: 12
  { name: "Chad", code: "TD", flag: "🇹🇩", phoneCode: "+235", nationalLength: 8, totalLength: 12 },
  // Country: Chile (+56) - National: 9 - Total Chars: 12
  { name: "Chile", code: "CL", flag: "🇨🇱", phoneCode: "+56", nationalLength: 9, totalLength: 12 },
  // Country: China (+86) - National: 11 - Total Chars: 14
  { name: "China", code: "CN", flag: "🇨🇳", phoneCode: "+86", nationalLength: 11, totalLength: 14 },
  // Country: Christmas Island (+61) - National: 9 - Total Chars: 12
  { name: "Christmas Island", code: "CX", flag: "🇨🇽", phoneCode: "+61", nationalLength: 9, totalLength: 12 },
  // Country: Cocos (Keeling) Islands (+61) - National: 9 - Total Chars: 12
  { name: "Cocos (Keeling) Islands", code: "CC", flag: "🇨🇨", phoneCode: "+61", nationalLength: 9, totalLength: 12 },
  // Country: Colombia (+57) - National: 10 - Total Chars: 13
  { name: "Colombia", code: "CO", flag: "🇨🇴", phoneCode: "+57", nationalLength: 10, totalLength: 13 },
  // Country: Comoros (+269) - National: 7 - Total Chars: 11
  { name: "Comoros", code: "KM", flag: "🇰🇲", phoneCode: "+269", nationalLength: 7, totalLength: 11 },
  // Country: Congo (+242) - National: 9 - Total Chars: 13
  { name: "Congo", code: "CG", flag: "🇨🇬", phoneCode: "+242", nationalLength: 9, totalLength: 13 },
  // Country: Congo, Democratic Republic of the (+243) - National: 9 - Total Chars: 13
  { name: "Congo, Democratic Republic of the", code: "CD", flag: "🇨🇩", phoneCode: "+243", nationalLength: 9, totalLength: 13 },
  // Country: Cook Islands (+682) - National: 5 - Total Chars: 9
  { name: "Cook Islands", code: "CK", flag: "🇨🇰", phoneCode: "+682", nationalLength: 5, totalLength: 9 },
  // Country: Costa Rica (+506) - National: 8 - Total Chars: 12
  { name: "Costa Rica", code: "CR", flag: "🇨🇷", phoneCode: "+506", nationalLength: 8, totalLength: 12 },
  // Country: Côte d'Ivoire (+225) - National: 10 - Total Chars: 14
  { name: "Côte d'Ivoire", code: "CI", flag: "🇨🇮", phoneCode: "+225", nationalLength: 10, totalLength: 14 },
  // Country: Croatia (+385) - National: 9 - Total Chars: 13
  { name: "Croatia", code: "HR", flag: "🇭🇷", phoneCode: "+385", nationalLength: 9, totalLength: 13 },
  // Country: Cuba (+53) - National: 8 - Total Chars: 11
  { name: "Cuba", code: "CU", flag: "🇨🇺", phoneCode: "+53", nationalLength: 8, totalLength: 11 },
  // Country: Curaçao (+599) - National: 8 - Total Chars: 12
  { name: "Curaçao", code: "CW", flag: "🇨🇼", phoneCode: "+599", nationalLength: 8, totalLength: 12 },
  // Country: Cyprus (+357) - National: 8 - Total Chars: 12
  { name: "Cyprus", code: "CY", flag: "🇨🇾", phoneCode: "+357", nationalLength: 8, totalLength: 12 },
  // Country: Czech Republic (+420) - National: 9 - Total Chars: 13
  { name: "Czech Republic", code: "CZ", flag: "🇨🇿", phoneCode: "+420", nationalLength: 9, totalLength: 13 },
  // Country: Denmark (+45) - National: 8 - Total Chars: 11
  { name: "Denmark", code: "DK", flag: "🇩🇰", phoneCode: "+45", nationalLength: 8, totalLength: 11 },
  // Country: Djibouti (+253) - National: 8 - Total Chars: 12
  { name: "Djibouti", code: "DJ", flag: "🇩🇯", phoneCode: "+253", nationalLength: 8, totalLength: 12 },
  // Country: Dominica (+1) - National: 10 - Total Chars: 12
  { name: "Dominica", code: "DM", flag: "🇩🇲", phoneCode: "+1", nationalLength: 10, totalLength: 12 },
  // Country: Dominican Republic (+1) - National: 10 - Total Chars: 12
  { name: "Dominican Republic", code: "DO", flag: "🇩🇴", phoneCode: "+1", nationalLength: 10, totalLength: 12 },
  // Country: Ecuador (+593) - National: 9 - Total Chars: 13
  { name: "Ecuador", code: "EC", flag: "🇪🇨", phoneCode: "+593", nationalLength: 9, totalLength: 13 },
  // Country: Egypt (+20) - National: 10 - Total Chars: 13
  { name: "Egypt", code: "EG", flag: "🇪🇬", phoneCode: "+20", nationalLength: 10, totalLength: 13 },
  // Country: El Salvador (+503) - National: 8 - Total Chars: 12
  { name: "El Salvador", code: "SV", flag: "🇸🇻", phoneCode: "+503", nationalLength: 8, totalLength: 12 },
  // Country: Equatorial Guinea (+240) - National: 9 - Total Chars: 13
  { name: "Equatorial Guinea", code: "GQ", flag: "🇬🇶", phoneCode: "+240", nationalLength: 9, totalLength: 13 },
  // Country: Eritrea (+291) - National: 7 - Total Chars: 11
  { name: "Eritrea", code: "ER", flag: "🇪🇷", phoneCode: "+291", nationalLength: 7, totalLength: 11 },
  // Country: Estonia (+372) - National: 8 - Total Chars: 12
  { name: "Estonia", code: "EE", flag: "🇪🇪", phoneCode: "+372", nationalLength: 8, totalLength: 12 },
  // Country: Ethiopia (+251) - National: 9 - Total Chars: 13
  { name: "Ethiopia", code: "ET", flag: "🇪🇹", phoneCode: "+251", nationalLength: 9, totalLength: 13 },
  // Country: Falkland Islands (+500) - National: 5 - Total Chars: 9
  { name: "Falkland Islands", code: "FK", flag: "🇫🇰", phoneCode: "+500", nationalLength: 5, totalLength: 9 },
  // Country: Faroe Islands (+298) - National: 6 - Total Chars: 10
  { name: "Faroe Islands", code: "FO", flag: "🇫🇴", phoneCode: "+298", nationalLength: 6, totalLength: 10 },
  // Country: Fiji (+679) - National: 7 - Total Chars: 11
  { name: "Fiji", code: "FJ", flag: "🇫🇯", phoneCode: "+679", nationalLength: 7, totalLength: 11 },
  // Country: Finland (+358) - National: 12 - Total Chars: 16
  { name: "Finland", code: "FI", flag: "🇫🇮", phoneCode: "+358", nationalLength: 12, totalLength: 16 },
  // Country: France (+33) - National: 9 - Total Chars: 12
  { name: "France", code: "FR", flag: "🇫🇷", phoneCode: "+33", nationalLength: 9, totalLength: 12 },
  // Country: French Guiana (+594) - National: 9 - Total Chars: 13
  { name: "French Guiana", code: "GF", flag: "🇬🇫", phoneCode: "+594", nationalLength: 9, totalLength: 13 },
  // Country: French Polynesia (+689) - National: 6 - Total Chars: 10
  { name: "French Polynesia", code: "PF", flag: "🇵🇫", phoneCode: "+689", nationalLength: 6, totalLength: 10 },
  // Country: Gabon (+241) - National: 8 - Total Chars: 12
  { name: "Gabon", code: "GA", flag: "🇬🇦", phoneCode: "+241", nationalLength: 8, totalLength: 12 },
  // Country: Gambia (+220) - National: 7 - Total Chars: 11
  { name: "Gambia", code: "GM", flag: "🇬🇲", phoneCode: "+220", nationalLength: 7, totalLength: 11 },
  // Country: Georgia (+995) - National: 9 - Total Chars: 13
  { name: "Georgia", code: "GE", flag: "🇬🇪", phoneCode: "+995", nationalLength: 9, totalLength: 13 },
  // Country: Germany (+49) - National: 11 - Total Chars: 14
  { name: "Germany", code: "DE", flag: "🇩🇪", phoneCode: "+49", nationalLength: 11, totalLength: 14 },
  // Country: Ghana (+233) - National: 9 - Total Chars: 13
  { name: "Ghana", code: "GH", flag: "🇬🇭", phoneCode: "+233", nationalLength: 9, totalLength: 13 },
  // Country: Gibraltar (+350) - National: 8 - Total Chars: 12
  { name: "Gibraltar", code: "GI", flag: "🇬🇮", phoneCode: "+350", nationalLength: 8, totalLength: 12 },
  // Country: Greece (+30) - National: 10 - Total Chars: 13
  { name: "Greece", code: "GR", flag: "🇬🇷", phoneCode: "+30", nationalLength: 10, totalLength: 13 },
  // Country: Greenland (+299) - National: 6 - Total Chars: 10
  { name: "Greenland", code: "GL", flag: "🇬🇱", phoneCode: "+299", nationalLength: 6, totalLength: 10 },
  // Country: Grenada (+1) - National: 10 - Total Chars: 12
  { name: "Grenada", code: "GD", flag: "🇬🇩", phoneCode: "+1", nationalLength: 10, totalLength: 12 },
  // Country: Guadeloupe (+590) - National: 9 - Total Chars: 13
  { name: "Guadeloupe", code: "GP", flag: "🇬🇵", phoneCode: "+590", nationalLength: 9, totalLength: 13 },
  // Country: Guam (+1) - National: 10 - Total Chars: 12
  { name: "Guam", code: "GU", flag: "🇬🇺", phoneCode: "+1", nationalLength: 10, totalLength: 12 },
  // Country: Guatemala (+502) - National: 8 - Total Chars: 12
  { name: "Guatemala", code: "GT", flag: "🇬🇹", phoneCode: "+502", nationalLength: 8, totalLength: 12 },
  // Country: Guernsey (+44) - National: 10 - Total Chars: 13
  { name: "Guernsey", code: "GG", flag: "🇬🇬", phoneCode: "+44", nationalLength: 10, totalLength: 13 },
  // Country: Guinea (+224) - National: 9 - Total Chars: 13
  { name: "Guinea", code: "GN", flag: "🇬🇳", phoneCode: "+224", nationalLength: 9, totalLength: 13 },
  // Country: Guinea-Bissau (+245) - National: 9 - Total Chars: 13
  { name: "Guinea-Bissau", code: "GW", flag: "🇬🇼", phoneCode: "+245", nationalLength: 9, totalLength: 13 },
  // Country: Guyana (+592) - National: 7 - Total Chars: 11
  { name: "Guyana", code: "GY", flag: "🇬🇾", phoneCode: "+592", nationalLength: 7, totalLength: 11 },
  // Country: Haiti (+509) - National: 8 - Total Chars: 12
  { name: "Haiti", code: "HT", flag: "🇭🇹", phoneCode: "+509", nationalLength: 8, totalLength: 12 },
  // Country: Honduras (+504) - National: 8 - Total Chars: 12
  { name: "Honduras", code: "HN", flag: "🇭🇳", phoneCode: "+504", nationalLength: 8, totalLength: 12 },
  // Country: Hong Kong (+852) - National: 8 - Total Chars: 12
  { name: "Hong Kong", code: "HK", flag: "🇭🇰", phoneCode: "+852", nationalLength: 8, totalLength: 12 },
  // Country: Hungary (+36) - National: 9 - Total Chars: 12
  { name: "Hungary", code: "HU", flag: "🇭🇺", phoneCode: "+36", nationalLength: 9, totalLength: 12 },
  // Country: Iceland (+354) - National: 7 - Total Chars: 11
  { name: "Iceland", code: "IS", flag: "🇮🇸", phoneCode: "+354", nationalLength: 7, totalLength: 11 },
  // Country: India (+91) - National: 10 - Total Chars: 13
  { name: "India", code: "IN", flag: "🇮🇳", phoneCode: "+91", nationalLength: 10, totalLength: 13 },
  // Country: Indonesia (+62) - National: 13 - Total Chars: 16
  { name: "Indonesia", code: "ID", flag: "🇮🇩", phoneCode: "+62", nationalLength: 13, totalLength: 16 },
  // Country: Iran (+98) - National: 10 - Total Chars: 13
  { name: "Iran", code: "IR", flag: "🇮🇷", phoneCode: "+98", nationalLength: 10, totalLength: 13 },
  // Country: Iraq (+964) - National: 10 - Total Chars: 14
  { name: "Iraq", code: "IQ", flag: "🇮🇶", phoneCode: "+964", nationalLength: 10, totalLength: 14 },
  // Country: Ireland (+353) - National: 9 - Total Chars: 13
  { name: "Ireland", code: "IE", flag: "🇮🇪", phoneCode: "+353", nationalLength: 9, totalLength: 13 },
  // Country: Isle of Man (+44) - National: 10 - Total Chars: 13
  { name: "Isle of Man", code: "IM", flag: "🇮🇲", phoneCode: "+44", nationalLength: 10, totalLength: 13 },
  // Country: Israel (+972) - National: 9 - Total Chars: 13
  { name: "Israel", code: "IL", flag: "🇮🇱", phoneCode: "+972", nationalLength: 9, totalLength: 13 },
  // Country: Italy (+39) - National: 10 - Total Chars: 13
  { name: "Italy", code: "IT", flag: "🇮🇹", phoneCode: "+39", nationalLength: 10, totalLength: 13 },
  // Country: Jamaica (+1) - National: 10 - Total Chars: 12
  { name: "Jamaica", code: "JM", flag: "🇯🇲", phoneCode: "+1", nationalLength: 10, totalLength: 12 },
  // Country: Japan (+81) - National: 10 - Total Chars: 13
  { name: "Japan", code: "JP", flag: "🇯🇵", phoneCode: "+81", nationalLength: 10, totalLength: 13 },
  // Country: Jersey (+44) - National: 10 - Total Chars: 13
  { name: "Jersey", code: "JE", flag: "🇯🇪", phoneCode: "+44", nationalLength: 10, totalLength: 13 },
  // Country: Jordan (+962) - National: 9 - Total Chars: 13
  { name: "Jordan", code: "JO", flag: "🇯🇴", phoneCode: "+962", nationalLength: 9, totalLength: 13 },
  // Country: Kazakhstan (+7) - National: 10 - Total Chars: 12
  { name: "Kazakhstan", code: "KZ", flag: "🇰🇿", phoneCode: "+7", nationalLength: 10, totalLength: 12 },
  // Country: Kenya (+254) - National: 9 - Total Chars: 13
  { name: "Kenya", code: "KE", flag: "🇰🇪", phoneCode: "+254", nationalLength: 9, totalLength: 13 },
  // Country: Kiribati (+686) - National: 5 - Total Chars: 9
  { name: "Kiribati", code: "KI", flag: "🇰🇮", phoneCode: "+686", nationalLength: 5, totalLength: 9 },
  // Country: Kosovo (+383) - National: 8 - Total Chars: 12
  { name: "Kosovo", code: "XK", flag: "🇽🇰", phoneCode: "+383", nationalLength: 8, totalLength: 12 },
  // Country: Kuwait (+965) - National: 8 - Total Chars: 12
  { name: "Kuwait", code: "KW", flag: "🇰🇼", phoneCode: "+965", nationalLength: 8, totalLength: 12 },
  // Country: Kyrgyzstan (+996) - National: 9 - Total Chars: 13
  { name: "Kyrgyzstan", code: "KG", flag: "🇰🇬", phoneCode: "+996", nationalLength: 9, totalLength: 13 },
  // Country: Laos (+856) - National: 10 - Total Chars: 14
  { name: "Laos", code: "LA", flag: "🇱🇦", phoneCode: "+856", nationalLength: 10, totalLength: 14 },
  // Country: Latvia (+371) - National: 8 - Total Chars: 12
  { name: "Latvia", code: "LV", flag: "🇱🇻", phoneCode: "+371", nationalLength: 8, totalLength: 12 },
  // Country: Lebanon (+961) - National: 8 - Total Chars: 12
  { name: "Lebanon", code: "LB", flag: "🇱🇧", phoneCode: "+961", nationalLength: 8, totalLength: 12 },
  // Country: Lesotho (+266) - National: 8 - Total Chars: 12
  { name: "Lesotho", code: "LS", flag: "🇱🇸", phoneCode: "+266", nationalLength: 8, totalLength: 12 },
  // Country: Liberia (+231) - National: 8 - Total Chars: 12
  { name: "Liberia", code: "LR", flag: "🇱🇷", phoneCode: "+231", nationalLength: 8, totalLength: 12 },
  // Country: Libya (+218) - National: 9 - Total Chars: 13
  { name: "Libya", code: "LY", flag: "🇱🇾", phoneCode: "+218", nationalLength: 9, totalLength: 13 },
  // Country: Liechtenstein (+423) - National: 7 - Total Chars: 11
  { name: "Liechtenstein", code: "LI", flag: "🇱🇮", phoneCode: "+423", nationalLength: 7, totalLength: 11 },
  // Country: Lithuania (+370) - National: 8 - Total Chars: 12
  { name: "Lithuania", code: "LT", flag: "🇱🇹", phoneCode: "+370", nationalLength: 8, totalLength: 12 },
  // Country: Luxembourg (+352) - National: 11 - Total Chars: 15
  { name: "Luxembourg", code: "LU", flag: "🇱🇺", phoneCode: "+352", nationalLength: 11, totalLength: 15 },
  // Country: Macau (+853) - National: 8 - Total Chars: 12
  { name: "Macau", code: "MO", flag: "🇲🇴", phoneCode: "+853", nationalLength: 8, totalLength: 12 },
  // Country: Macedonia (North) (+389) - National: 8 - Total Chars: 12
  { name: "Macedonia (North)", code: "MK", flag: "🇲🇰", phoneCode: "+389", nationalLength: 8, totalLength: 12 },
  // Country: Madagascar (+261) - National: 9 - Total Chars: 13
  { name: "Madagascar", code: "MG", flag: "🇲🇬", phoneCode: "+261", nationalLength: 9, totalLength: 13 },
  // Country: Malawi (+265) - National: 9 - Total Chars: 13
  { name: "Malawi", code: "MW", flag: "🇲🇼", phoneCode: "+265", nationalLength: 9, totalLength: 13 },
  // Country: Malaysia (+60) - National: 10 - Total Chars: 13
  { name: "Malaysia", code: "MY", flag: "🇲🇾", phoneCode: "+60", nationalLength: 10, totalLength: 13 },
  // Country: Maldives (+960) - National: 7 - Total Chars: 11
  { name: "Maldives", code: "MV", flag: "🇲🇻", phoneCode: "+960", nationalLength: 7, totalLength: 11 },
  // Country: Mali (+223) - National: 8 - Total Chars: 12
  { name: "Mali", code: "ML", flag: "🇲🇱", phoneCode: "+223", nationalLength: 8, totalLength: 12 },
  // Country: Malta (+356) - National: 8 - Total Chars: 12
  { name: "Malta", code: "MT", flag: "🇲🇹", phoneCode: "+356", nationalLength: 8, totalLength: 12 },
  // Country: Marshall Islands (+692) - National: 7 - Total Chars: 11
  { name: "Marshall Islands", code: "MH", flag: "🇲🇭", phoneCode: "+692", nationalLength: 7, totalLength: 11 },
  // Country: Martinique (+596) - National: 9 - Total Chars: 13
  { name: "Martinique", code: "MQ", flag: "🇲🇶", phoneCode: "+596", nationalLength: 9, totalLength: 13 },
  // Country: Mauritania (+222) - National: 8 - Total Chars: 12
  { name: "Mauritania", code: "MR", flag: "🇲🇷", phoneCode: "+222", nationalLength: 8, totalLength: 12 },
  // Country: Mauritius (+230) - National: 8 - Total Chars: 12
  { name: "Mauritius", code: "MU", flag: "🇲🇺", phoneCode: "+230", nationalLength: 8, totalLength: 12 },
  // Country: Mayotte (+262) - National: 9 - Total Chars: 13
  { name: "Mayotte", code: "YT", flag: "🇾🇹", phoneCode: "+262", nationalLength: 9, totalLength: 13 },
  // Country: Mexico (+52) - National: 10 - Total Chars: 13
  { name: "Mexico", code: "MX", flag: "🇲🇽", phoneCode: "+52", nationalLength: 10, totalLength: 13 },
  // Country: Micronesia (+691) - National: 7 - Total Chars: 11
  { name: "Micronesia", code: "FM", flag: "🇫🇲", phoneCode: "+691", nationalLength: 7, totalLength: 11 },
  // Country: Moldova (+373) - National: 8 - Total Chars: 12
  { name: "Moldova", code: "MD", flag: "🇲🇩", phoneCode: "+373", nationalLength: 8, totalLength: 12 },
  // Country: Monaco (+377) - National: 9 - Total Chars: 13
  { name: "Monaco", code: "MC", flag: "🇲🇨", phoneCode: "+377", nationalLength: 9, totalLength: 13 },
  // Country: Mongolia (+976) - National: 8 - Total Chars: 12
  { name: "Mongolia", code: "MN", flag: "🇲🇳", phoneCode: "+976", nationalLength: 8, totalLength: 12 },
  // Country: Montenegro (+382) - National: 8 - Total Chars: 12
  { name: "Montenegro", code: "ME", flag: "🇲🇪", phoneCode: "+382", nationalLength: 8, totalLength: 12 },
  // Country: Montserrat (+1) - National: 10 - Total Chars: 12
  { name: "Montserrat", code: "MS", flag: "🇲🇸", phoneCode: "+1", nationalLength: 10, totalLength: 12 },
  // Country: Morocco (+212) - National: 9 - Total Chars: 13
  { name: "Morocco", code: "MA", flag: "🇲🇦", phoneCode: "+212", nationalLength: 9, totalLength: 13 },
  // Country: Mozambique (+258) - National: 9 - Total Chars: 13
  { name: "Mozambique", code: "MZ", flag: "🇲🇿", phoneCode: "+258", nationalLength: 9, totalLength: 13 },
  // Country: Myanmar (+95) - National: 10 - Total Chars: 13
  { name: "Myanmar", code: "MM", flag: "🇲🇲", phoneCode: "+95", nationalLength: 10, totalLength: 13 },
  // Country: Namibia (+264) - National: 9 - Total Chars: 13
  { name: "Namibia", code: "NA", flag: "🇳🇦", phoneCode: "+264", nationalLength: 9, totalLength: 13 },
  // Country: Nauru (+674) - National: 7 - Total Chars: 11
  { name: "Nauru", code: "NR", flag: "🇳🇷", phoneCode: "+674", nationalLength: 7, totalLength: 11 },
  // Country: Nepal (+977) - National: 10 - Total Chars: 14
  { name: "Nepal", code: "NP", flag: "🇳🇵", phoneCode: "+977", nationalLength: 10, totalLength: 14 },
  // Country: Netherlands (+31) - National: 9 - Total Chars: 12
  { name: "Netherlands", code: "NL", flag: "🇳🇱", phoneCode: "+31", nationalLength: 9, totalLength: 12 },
  // Country: New Caledonia (+687) - National: 6 - Total Chars: 10
  { name: "New Caledonia", code: "NC", flag: "🇳🇨", phoneCode: "+687", nationalLength: 6, totalLength: 10 },
  // Country: New Zealand (+64) - National: 10 - Total Chars: 13
  { name: "New Zealand", code: "NZ", flag: "🇳🇿", phoneCode: "+64", nationalLength: 10, totalLength: 13 },
  // Country: Nicaragua (+505) - National: 8 - Total Chars: 12
  { name: "Nicaragua", code: "NI", flag: "🇳🇮", phoneCode: "+505", nationalLength: 8, totalLength: 12 },
  // Country: Niger (+227) - National: 8 - Total Chars: 12
  { name: "Niger", code: "NE", flag: "🇳🇪", phoneCode: "+227", nationalLength: 8, totalLength: 12 },
  // Country: Nigeria (+234) - National: 10 - Total Chars: 14
  { name: "Nigeria", code: "NG", flag: "🇳🇬", phoneCode: "+234", nationalLength: 10, totalLength: 14 },
  // Country: Niue (+683) - National: 4 - Total Chars: 8
  { name: "Niue", code: "NU", flag: "🇳🇺", phoneCode: "+683", nationalLength: 4, totalLength: 8 },
  // Country: Norfolk Island (+672) - National: 6 - Total Chars: 10
  { name: "Norfolk Island", code: "NF", flag: "🇳🇫", phoneCode: "+672", nationalLength: 6, totalLength: 10 },
  // Country: North Korea (+850) - National: 10 - Total Chars: 14
  { name: "North Korea", code: "KP", flag: "🇰🇵", phoneCode: "+850", nationalLength: 10, totalLength: 14 },
  // Country: Northern Mariana Islands (+1) - National: 10 - Total Chars: 12
  { name: "Northern Mariana Islands", code: "MP", flag: "🇲🇵", phoneCode: "+1", nationalLength: 10, totalLength: 12 },
  // Country: Norway (+47) - National: 8 - Total Chars: 11
  { name: "Norway", code: "NO", flag: "🇳🇴", phoneCode: "+47", nationalLength: 8, totalLength: 11 },
  // Country: Oman (+968) - National: 8 - Total Chars: 12
  { name: "Oman", code: "OM", flag: "🇴🇲", phoneCode: "+968", nationalLength: 8, totalLength: 12 },
  // Country: Pakistan (+92) - National: 10 - Total Chars: 13
  { name: "Pakistan", code: "PK", flag: "🇵🇰", phoneCode: "+92", nationalLength: 10, totalLength: 13 },
  // Country: Palau (+680) - National: 7 - Total Chars: 11
  { name: "Palau", code: "PW", flag: "🇵🇼", phoneCode: "+680", nationalLength: 7, totalLength: 11 },
  // Country: Palestine (+970) - National: 9 - Total Chars: 13
  { name: "Palestine", code: "PS", flag: "🇵🇸", phoneCode: "+970", nationalLength: 9, totalLength: 13 },
  // Country: Panama (+507) - National: 8 - Total Chars: 12
  { name: "Panama", code: "PA", flag: "🇵🇦", phoneCode: "+507", nationalLength: 8, totalLength: 12 },
  // Country: Papua New Guinea (+675) - National: 8 - Total Chars: 12
  { name: "Papua New Guinea", code: "PG", flag: "🇵🇬", phoneCode: "+675", nationalLength: 8, totalLength: 12 },
  // Country: Paraguay (+595) - National: 9 - Total Chars: 13
  { name: "Paraguay", code: "PY", flag: "🇵🇾", phoneCode: "+595", nationalLength: 9, totalLength: 13 },
  // Country: Peru (+51) - National: 9 - Total Chars: 12
  { name: "Peru", code: "PE", flag: "🇵🇪", phoneCode: "+51", nationalLength: 9, totalLength: 12 },
  // Country: Philippines (+63) - National: 10 - Total Chars: 13
  { name: "Philippines", code: "PH", flag: "🇵🇭", phoneCode: "+63", nationalLength: 10, totalLength: 13 },
  // Country: Poland (+48) - National: 9 - Total Chars: 12
  { name: "Poland", code: "PL", flag: "🇵🇱", phoneCode: "+48", nationalLength: 9, totalLength: 12 },
  // Country: Portugal (+351) - National: 9 - Total Chars: 13
  { name: "Portugal", code: "PT", flag: "🇵🇹", phoneCode: "+351", nationalLength: 9, totalLength: 13 },
  // Country: Puerto Rico (+1) - National: 10 - Total Chars: 12
  { name: "Puerto Rico", code: "PR", flag: "🇵🇷", phoneCode: "+1", nationalLength: 10, totalLength: 12 },
  // Country: Qatar (+974) - National: 8 - Total Chars: 12
  { name: "Qatar", code: "QA", flag: "🇶🇦", phoneCode: "+974", nationalLength: 8, totalLength: 12 },
  // Country: Réunion (+262) - National: 9 - Total Chars: 13
  { name: "Réunion", code: "RE", flag: "🇷🇪", phoneCode: "+262", nationalLength: 9, totalLength: 13 },
  // Country: Romania (+40) - National: 9 - Total Chars: 12
  { name: "Romania", code: "RO", flag: "🇷🇴", phoneCode: "+40", nationalLength: 9, totalLength: 12 },
  // Country: Russia (+7) - National: 10 - Total Chars: 12
  { name: "Russia", code: "RU", flag: "🇷🇺", phoneCode: "+7", nationalLength: 10, totalLength: 12 },
  // Country: Rwanda (+250) - National: 9 - Total Chars: 13
  { name: "Rwanda", code: "RW", flag: "🇷🇼", phoneCode: "+250", nationalLength: 9, totalLength: 13 },
  // Country: Saint Barthélemy (+590) - National: 9 - Total Chars: 13
  { name: "Saint Barthélemy", code: "BL", flag: "🇧🇱", phoneCode: "+590", nationalLength: 9, totalLength: 13 },
  // Country: Saint Helena (+290) - National: 5 - Total Chars: 9
  { name: "Saint Helena", code: "SH", flag: "🇸🇭", phoneCode: "+290", nationalLength: 5, totalLength: 9 },
  // Country: Saint Kitts and Nevis (+1) - National: 10 - Total Chars: 12
  { name: "Saint Kitts and Nevis", code: "KN", flag: "🇰🇳", phoneCode: "+1", nationalLength: 10, totalLength: 12 },
  // Country: Saint Lucia (+1) - National: 10 - Total Chars: 12
  { name: "Saint Lucia", code: "LC", flag: "🇱🇨", phoneCode: "+1", nationalLength: 10, totalLength: 12 },
  // Country: Saint Martin (+590) - National: 9 - Total Chars: 13
  { name: "Saint Martin", code: "MF", flag: "🇲🇫", phoneCode: "+590", nationalLength: 9, totalLength: 13 },
  // Country: Saint Pierre and Miquelon (+508) - National: 6 - Total Chars: 10
  { name: "Saint Pierre and Miquelon", code: "PM", flag: "🇵🇲", phoneCode: "+508", nationalLength: 6, totalLength: 10 },
  // Country: Saint Vincent and the Grenadines (+1) - National: 10 - Total Chars: 12
  { name: "Saint Vincent and the Grenadines", code: "VC", flag: "🇻🇨", phoneCode: "+1", nationalLength: 10, totalLength: 12 },
  // Country: Samoa (+685) - National: 7 - Total Chars: 11
  { name: "Samoa", code: "WS", flag: "🇼🇸", phoneCode: "+685", nationalLength: 7, totalLength: 11 },
  // Country: San Marino (+378) - National: 10 - Total Chars: 14
  { name: "San Marino", code: "SM", flag: "🇸🇲", phoneCode: "+378", nationalLength: 10, totalLength: 14 },
  // Country: Sao Tome and Principe (+239) - National: 7 - Total Chars: 11
  { name: "Sao Tome and Principe", code: "ST", flag: "🇸🇹", phoneCode: "+239", nationalLength: 7, totalLength: 11 },
  // Country: Saudi Arabia (+966) - National: 9 - Total Chars: 13
  { name: "Saudi Arabia", code: "SA", flag: "🇸🇦", phoneCode: "+966", nationalLength: 9, totalLength: 13 },
  // Country: Senegal (+221) - National: 9 - Total Chars: 13
  { name: "Senegal", code: "SN", flag: "🇸🇳", phoneCode: "+221", nationalLength: 9, totalLength: 13 },
  // Country: Serbia (+381) - National: 9 - Total Chars: 13
  { name: "Serbia", code: "RS", flag: "🇷🇸", phoneCode: "+381", nationalLength: 9, totalLength: 13 },
  // Country: Seychelles (+248) - National: 7 - Total Chars: 11
  { name: "Seychelles", code: "SC", flag: "🇸🇨", phoneCode: "+248", nationalLength: 7, totalLength: 11 },
  // Country: Sierra Leone (+232) - National: 8 - Total Chars: 12
  { name: "Sierra Leone", code: "SL", flag: "🇸🇱", phoneCode: "+232", nationalLength: 8, totalLength: 12 },
  // Country: Singapore (+65) - National: 8 - Total Chars: 11
  { name: "Singapore", code: "SG", flag: "🇸🇬", phoneCode: "+65", nationalLength: 8, totalLength: 11 },
  // Country: Sint Maarten (+1) - National: 10 - Total Chars: 12
  { name: "Sint Maarten", code: "SX", flag: "🇸🇽", phoneCode: "+1", nationalLength: 10, totalLength: 12 },
  // Country: Slovakia (+421) - National: 9 - Total Chars: 13
  { name: "Slovakia", code: "SK", flag: "🇸🇰", phoneCode: "+421", nationalLength: 9, totalLength: 13 },
  // Country: Slovenia (+386) - National: 8 - Total Chars: 12
  { name: "Slovenia", code: "SI", flag: "🇸🇮", phoneCode: "+386", nationalLength: 8, totalLength: 12 },
  // Country: Solomon Islands (+677) - National: 7 - Total Chars: 11
  { name: "Solomon Islands", code: "SB", flag: "🇸🇧", phoneCode: "+677", nationalLength: 7, totalLength: 11 },
  // Country: Somalia (+252) - National: 9 - Total Chars: 13
  { name: "Somalia", code: "SO", flag: "🇸🇴", phoneCode: "+252", nationalLength: 9, totalLength: 13 },
  // Country: South Africa (+27) - National: 9 - Total Chars: 12
  { name: "South Africa", code: "ZA", flag: "🇿🇦", phoneCode: "+27", nationalLength: 9, totalLength: 12 },
  // Country: South Korea (+82) - National: 10 - Total Chars: 13
  { name: "South Korea", code: "KR", flag: "🇰🇷", phoneCode: "+82", nationalLength: 10, totalLength: 13 },
  // Country: South Sudan (+211) - National: 9 - Total Chars: 13
  { name: "South Sudan", code: "SS", flag: "🇸🇸", phoneCode: "+211", nationalLength: 9, totalLength: 13 },
  // Country: Spain (+34) - National: 9 - Total Chars: 12
  { name: "Spain", code: "ES", flag: "🇪🇸", phoneCode: "+34", nationalLength: 9, totalLength: 12 },
  // Country: Sri Lanka (+94) - National: 9 - Total Chars: 12
  { name: "Sri Lanka", code: "LK", flag: "🇱🇰", phoneCode: "+94", nationalLength: 9, totalLength: 12 },
  // Country: Sudan (+249) - National: 9 - Total Chars: 13
  { name: "Sudan", code: "SD", flag: "🇸🇩", phoneCode: "+249", nationalLength: 9, totalLength: 13 },
  // Country: Suriname (+597) - National: 7 - Total Chars: 11
  { name: "Suriname", code: "SR", flag: "🇸🇷", phoneCode: "+597", nationalLength: 7, totalLength: 11 },
  // Country: Svalbard and Jan Mayen (+47) - National: 8 - Total Chars: 11
  { name: "Svalbard and Jan Mayen", code: "SJ", flag: "🇸🇯", phoneCode: "+47", nationalLength: 8, totalLength: 11 },
  // Country: Swaziland (+268) - National: 8 - Total Chars: 12
  { name: "Swaziland", code: "SZ", flag: "🇸🇿", phoneCode: "+268", nationalLength: 8, totalLength: 12 },
  // Country: Sweden (+46) - National: 13 - Total Chars: 16
  { name: "Sweden", code: "SE", flag: "🇸🇪", phoneCode: "+46", nationalLength: 13, totalLength: 16 },
  // Country: Switzerland (+41) - National: 9 - Total Chars: 12
  { name: "Switzerland", code: "CH", flag: "🇨🇭", phoneCode: "+41", nationalLength: 9, totalLength: 12 },
  // Country: Syria (+963) - National: 9 - Total Chars: 13
  { name: "Syria", code: "SY", flag: "🇸🇾", phoneCode: "+963", nationalLength: 9, totalLength: 13 },
  // Country: Taiwan (+886) - National: 9 - Total Chars: 13
  { name: "Taiwan", code: "TW", flag: "🇹🇼", phoneCode: "+886", nationalLength: 9, totalLength: 13 },
  // Country: Tajikistan (+992) - National: 9 - Total Chars: 13
  { name: "Tajikistan", code: "TJ", flag: "🇹🇯", phoneCode: "+992", nationalLength: 9, totalLength: 13 },
  // Country: Tanzania (+255) - National: 9 - Total Chars: 13
  { name: "Tanzania", code: "TZ", flag: "🇹🇿", phoneCode: "+255", nationalLength: 9, totalLength: 13 },
  // Country: Thailand (+66) - National: 9 - Total Chars: 12
  { name: "Thailand", code: "TH", flag: "🇹🇭", phoneCode: "+66", nationalLength: 9, totalLength: 12 },
  // Country: Timor-Leste (+670) - National: 8 - Total Chars: 12
  { name: "Timor-Leste", code: "TL", flag: "🇹🇱", phoneCode: "+670", nationalLength: 8, totalLength: 12 },
  // Country: Togo (+228) - National: 8 - Total Chars: 12
  { name: "Togo", code: "TG", flag: "🇹🇬", phoneCode: "+228", nationalLength: 8, totalLength: 12 },
  // Country: Tokelau (+690) - National: 4 - Total Chars: 8
  { name: "Tokelau", code: "TK", flag: "🇹🇰", phoneCode: "+690", nationalLength: 4, totalLength: 8 },
  // Country: Tonga (+676) - National: 7 - Total Chars: 11
  { name: "Tonga", code: "TO", flag: "🇹🇴", phoneCode: "+676", nationalLength: 7, totalLength: 11 },
  // Country: Trinidad and Tobago (+1) - National: 10 - Total Chars: 12
  { name: "Trinidad and Tobago", code: "TT", flag: "🇹🇹", phoneCode: "+1", nationalLength: 10, totalLength: 12 },
  // Country: Tunisia (+216) - National: 8 - Total Chars: 12
  { name: "Tunisia", code: "TN", flag: "🇹🇳", phoneCode: "+216", nationalLength: 8, totalLength: 12 },
  // Country: Turkey (+90) - National: 10 - Total Chars: 13
  { name: "Turkey", code: "TR", flag: "🇹🇷", phoneCode: "+90", nationalLength: 10, totalLength: 13 },
  // Country: Turkmenistan (+993) - National: 8 - Total Chars: 12
  { name: "Turkmenistan", code: "TM", flag: "🇹🇲", phoneCode: "+993", nationalLength: 8, totalLength: 12 },
  // Country: Turks and Caicos Islands (+1) - National: 10 - Total Chars: 12
  { name: "Turks and Caicos Islands", code: "TC", flag: "🇹🇨", phoneCode: "+1", nationalLength: 10, totalLength: 12 },
  // Country: Tuvalu (+688) - National: 6 - Total Chars: 10
  { name: "Tuvalu", code: "TV", flag: "🇹🇻", phoneCode: "+688", nationalLength: 6, totalLength: 10 },
  // Country: Uganda (+256) - National: 9 - Total Chars: 13
  { name: "Uganda", code: "UG", flag: "🇺🇬", phoneCode: "+256", nationalLength: 9, totalLength: 13 },
  // Country: Ukraine (+380) - National: 9 - Total Chars: 13
  { name: "Ukraine", code: "UA", flag: "🇺🇦", phoneCode: "+380", nationalLength: 9, totalLength: 13 },
  // Country: United Arab Emirates (+971) - National: 9 - Total Chars: 13
  { name: "United Arab Emirates", code: "AE", flag: "🇦🇪", phoneCode: "+971", nationalLength: 9, totalLength: 13 },
  // Country: United Kingdom (+44) - National: 10 - Total Chars: 13
  { name: "United Kingdom", code: "GB", flag: "🇬🇧", phoneCode: "+44", nationalLength: 10, totalLength: 13 },
  // Country: United States (+1) - National: 10 - Total Chars: 12
  { name: "United States", code: "US", flag: "🇺🇸", phoneCode: "+1", nationalLength: 10, totalLength: 12 },
  // Country: Uruguay (+598) - National: 8 - Total Chars: 12
  { name: "Uruguay", code: "UY", flag: "🇺🇾", phoneCode: "+598", nationalLength: 8, totalLength: 12 },
  // Country: US Virgin Islands (+1) - National: 10 - Total Chars: 12
  { name: "US Virgin Islands", code: "VI", flag: "🇻🇮", phoneCode: "+1", nationalLength: 10, totalLength: 12 },
  // Country: Uzbekistan (+998) - National: 9 - Total Chars: 13
  { name: "Uzbekistan", code: "UZ", flag: "🇺🇿", phoneCode: "+998", nationalLength: 9, totalLength: 13 },
  // Country: Vanuatu (+678) - National: 7 - Total Chars: 11
  { name: "Vanuatu", code: "VU", flag: "🇻🇺", phoneCode: "+678", nationalLength: 7, totalLength: 11 },
  // Country: Vatican City (+39) - National: 10 - Total Chars: 13
  { name: "Vatican City", code: "VA", flag: "🇻🇦", phoneCode: "+39", nationalLength: 10, totalLength: 13 },
  // Country: Venezuela (+58) - National: 10 - Total Chars: 13
  { name: "Venezuela", code: "VE", flag: "🇻🇪", phoneCode: "+58", nationalLength: 10, totalLength: 13 },
  // Country: Vietnam (+84) - National: 10 - Total Chars: 13
  { name: "Vietnam", code: "VN", flag: "🇻🇳", phoneCode: "+84", nationalLength: 10, totalLength: 13 },
  // Country: Wallis and Futuna (+681) - National: 6 - Total Chars: 10
  { name: "Wallis and Futuna", code: "WF", flag: "🇼🇫", phoneCode: "+681", nationalLength: 6, totalLength: 10 },
  // Country: Yemen (+967) - National: 9 - Total Chars: 13
  { name: "Yemen", code: "YE", flag: "🇾🇪", phoneCode: "+967", nationalLength: 9, totalLength: 13 },
  // Country: Zambia (+260) - National: 9 - Total Chars: 13
  { name: "Zambia", code: "ZM", flag: "🇿🇲", phoneCode: "+260", nationalLength: 9, totalLength: 13 },
  // Country: Zimbabwe (+263) - National: 9 - Total Chars: 13
  { name: "Zimbabwe", code: "ZW", flag: "🇿🇼", phoneCode: "+263", nationalLength: 9, totalLength: 13 },
];
// Helper function to search countries
export const searchCountries = (query) => {
  const lowerQuery = query.toLowerCase();
  return countries.filter(
    (country) =>
      country.name.toLowerCase().includes(lowerQuery) ||
      country.code.toLowerCase().includes(lowerQuery) ||
      country.phoneCode.includes(query)
  );
};

// Helper function to get country by code
export const getCountryByCode = (code) => {
  return countries.find((country) => country.code === code);
};

// Helper function to get country by phone code
export const getCountryByPhoneCode = (phoneCode) => {
  return countries.find((country) => country.phoneCode === phoneCode);
};

