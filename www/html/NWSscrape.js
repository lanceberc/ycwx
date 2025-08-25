/*
  https://tgftp.nws.noaa.gov/data/raw/sx/sxus86.kmtr.omr.mtr.txt

SXUS86 KMTR 101810
OMRMTR
Environmental Buoy and Coastal Weather Reports
National Weather Service San Francisco CA
11 AM PDT Mon Jul 10 2023

 --------------------------------------------------------------------
                       Time  Wind        Temp(F)  Pressure Wave Data 
 Buoy   Location       GMT   Dir KTS     Air Sea  (MB)     (FT) (SEC)
 --------------------------------------------------------------------
 46001  Glf Alaska     ---   --- -----   --  --   ------   --   --
 46041  Cp Elizabeth   18Z   --- 04G06   --  --   1018.5   --   --
 46005  Washington     18Z   320 10G14   57  60   1020.7   --   --
 46089  Tillamook      18Z   320 08G12   59  61   1020.0   --   --
 46050  Stnwall Bnks   18Z   180 08G10   57  59   1019.2   --   --
 46002  West Oregon    18Z   330 12G14   58  --   1021.2   --   --
 46015  Port Orford    ---   --- -----   --  --   ------   --   --
 46027  St Georges     18Z   340 02G04   56  54   1019.2   --   --
 46022  Eel River      ---   --- -----   --  --   ------   --   --
 46006  SE Papa        ---   --- -----   --  --   ------   --   --
 46213  Cp Mendocino   18Z               51                05   12
 --------------------------------------------------------------------
 46014  Pt Arna(Nrth)  18Z   340 16G18   54  53   1016.9   --   --
 46059  California     18Z   340 14G18   60  --   1023.1   05   11
 46013  Bodega Bay     18Z   320 18G21   53  51   1016.3   --   --
 46214  Pt Reyes       18Z               52                07   12
 46237  SF Bar         17Z               56                03   15
 46026  San Francisco  18Z   320 14G16   --  53   1017.6   --   --
 46012  Half Moon Bay  ---   --- -----   --  --   ------   --   --
 46091  MBay Inner     ---   --- -----   --  --   ------   --   --
 46266  Pajaro Beach   18Z               67                03   07
 46042  Monterey       18Z   330 16G19   54  57   1017.3   --   --
 46236  Mntrey Canyon  ---               --                --   --
 46269  Pt Santa Cruz  17Z               58                02   12
 46092  MBay Outer     17Z   300 10---   54  55   1017.0   --   --
 46240  Lovers Point   18Z               59                02   11
 46239  Pt Sur         18Z               54                05   13
 46028  Cp San Martn   18Z   330 18G23   54  55   1014.9   --   --
 --------------------------------------------------------------------
 46215  Diablo Canyon  18Z               59                03   06
 46011  Santa Maria    18Z   330 12G14   --  55   1013.0   --   --
 46218  Hrvest Pltfrm  18Z               56                05   07
 46054  Santa Brbra    18Z   320 16G19   54  55   1014.2   --   --
 46053  E Snta Brbra   18Z   000 00G02   59  62   1013.6   --   --
 46025  Santa Monica   18Z   130 06G08   63  66   1014.4   --   --
 46219  San Niclas Is  17Z               57                07   07


 Coastal Reports
 --------------------------------------------------------------------
                       Time  Wind       Temp Pres   Weather -   
 Id     Location       GMT   Dir KTS    (F)  (MB)   Visibility	
 --------------------------------------------------------------------
 PORO3  Port Orford OR 17Z   050 07G12  63  1018.3
 CECC1  Crescent City  17Z   320 05G08  56  1018.7
 ANVC1  Arena Cove     17Z   300 06G12  55  1016.7
 BGAC1  Bodega Bay CG  17Z   300 00G00  54
 SFXC1  Rush Rnch SFBr 17Z   270 08--   63  ------
 PREC1  Point Reyes    17Z   300 09G13  53
 FNDC1  Farallon Isl   ---   --- -----  --
 GGBC1  GG Bridge      ---   --- -----  --
 PCOC1  Port Chicago   17Z   280 09G11  62  1015.4
 DPXC1  Davis Pt       17Z   280 08G10  61  1015.8
 PSBC1  Suisun Bay     17Z   320 10G13  65  1015.1
 UPBC1  UPRR Br Mrtnez 17Z   310 07G11  --  ------
 MZXC1  Amorco Pier    17Z   300 11G12  61  1015.7
 RCMC1  Richmond       17Z   150 05G09  56  1016.4
 PPXC1  Pt Potrero     17Z   180 09G12  56  1017.0
 TIBC1  Tiburon Pier   16Z   150 06--   54  1016.0
 AISC1  Angel Isl      ---   --- -----  --
 AAMC1  Alameda        17Z   210 05G08  54  1016.9
 FTPC1  San Francisco  17Z   240 05G09  54  1015.9
 OKXC1  Oklnd Berth 34 17Z   220 04G06  55  1016.7
 OBXC1  Oklnd Berth 38 17Z   --- ----   63  ------
 LNDC1  Oklnd Berth 67 17Z   200 04G07  55  1016.7
 OMHC1  Oklnd Mid Hbr  17Z   210 04G07  --  ------
 PXSC1  SF Pier 17     ---   --- -----  --  ------
 PXOC1  SF Pier 1      17Z   270 02G06  56  1015.7
 KOAK   Oakland Arpt   17Z   220 03---  57  1017.2  CLDY
 KSFO   SF Arpt        17Z   290 14---  61  1016.4  MSTCLDY
 RTYC1  Redwood City   17Z   360 08G11  58  1016.3
 MBWC1  Montara Beach  17Z   320 07G13  -8190
 KHAF   Half Moon Bay  17Z   320 07---  55  1016.4  MIST; MSTCLDY
 ELXC1  Elkhrn Slough  17Z   300 06--   63  1016.0
 MTYC1  Monterey       ---   --- -----  --  ------
 PSLC1  Port San Luis  17Z   180 03G04  54  1015.8
 PTGC1  Pt Arguello    ---   --- -----  --  ------

$$
  
*/

export class NWSscrape {

    constructor (cc, cb) {

	this.config = cc;
	this.timeout = null;
	this.lastReport = null;
	this.callback = cb;
    
	function parsePage(state, d, stations) {
	    let section = "header";
	    const strings = d.split('\n');
	    const observations = {};
	    for (let i = 0; i < strings.length; i++) {
		const s = strings[i];
		let station = null;
		let gmt = null;
		let calm = '';
		let windDir = null;
		let windSpeed = null;
		let airTemp = null;
		let waterTemp = null;
		let mb = null;
		let waveHeight = null;
		let wavePeriod = null;
		if (section == "header") {
		    let d = s.slice(3, 5);
		    if ((d == "AM") || (d == "PM")) {
			state.lastReport = s;
		    }
		    if (s.slice(1,5) == "Buoy") {
			section = "Buoy";
		    }
		} else if (section == "Buoy") {
		    station = s.slice(1,6);
		    gmt = s.slice(23,25);
		    calm =  (s.slice(29, 38) == "WNDS CALM")
		    windDir = s.slice(29,32);
		    windSpeed = s.slice(33,38);
		    airTemp =  s.slice(41,43);
		    waterTemp =  s.slice(45,47);
		    mb =  s.slice(50,56);
		    waveHeight =  s.slice(59,61);
		    wavePeriod =  s.slice(64,66);
		    if (s.slice(1,8) == "Coastal") {
			section = "Coastal";
		    }
		} else if (section == "Coastal") {
		    station = s.slice(1,6);
		    gmt = s.slice(23,25);
		    calm =  (s.slice(29, 38) == "WNDS CALM")
		    windDir = s.slice(29,32);
		    windSpeed = s.slice(33,38);
		    airTemp =  s.slice(40,42);
		    mb =  s.slice(44,50);
		} else {
		    console.log(`NWSScrape unknown section '${section}'`);
		}
		while ((station != null) && (station.length > 0) && (station.at(station.length - 1) == ' ')) { // Trim trailing spaces
		    if (station.length > 1) {
			station = station.slice(0, station.length - 1);
		    } else {
			station = '';
		    }
		}
		if (station in stations) {
		    const hour = parseInt(gmt);
		    if (!isNaN(hour)) {
			let d;
			observations[station] = {};
			observations[station].nickName = stations[station].nickName;
			observations[station].gmt = hour;
			if (calm == true) {
			    observations[station].calm = true;
			} else {
			    d = parseInt(windDir);
			    if (!isNaN(d)) {
				observations[station].windDir = d;
			    }
			    if (!isNaN(parseInt(windSpeed))) {
				let speed = parseInt(windSpeed.slice(0,2));
				let gust = parseInt(windSpeed.slice(3,5));
				if (!isNaN(speed)) {
				    observations[station].windSpeed = speed;
				}
				if (!isNaN(gust)) {
				    observations[station].windGust = gust;
				}
			    }
			}
			d = parseInt(airTemp);
			if (!isNaN(d)) {
			    observations[station].airTemp = d;
			}
			d = parseInt(waterTemp);
			if (!isNaN(d)) {
			    observations[station].waterTemp = d;
			}
			d = parseFloat(mb);
			if (!isNaN(d)) {
			    observations[station].airPressure = d;
			}
			d = parseInt(waveHeight);
			if (!isNaN(d)) {
			    observations[station].waveHeight = d;
			}
			d = parseInt(wavePeriod);
			if (!isNaN(d)) {
			    observations[station].wavePeriod = d;
			}
		    }
		}
	    }
	    state.callback(observations);
	}

	function fetchURLs(state) {
	    for (let i in state.config) {
		const c = state.config[i];
		fetch(c.url,
		      // {mode: 'navigate'}
		     )
		    .then((response) => {
			if (!(response.ok)) {
			    console.log(`NWS Fetch ${c.url} failed: ${response.status}`);
			    return null;
			} else {
			    return response.text();
			}
		    })
		    .then((d) => {
			if (d != null) {
			    parsePage(state, d, c.stations);
			}
		    });
	    }
	}

	function hourly(state) {
	    const oneHour = 60 * 60 * 1000;
	    const oneMinute = 60 * 1000;
	    fetchURLs(state);
	    const now = Date.now();
	    const next = (Math.floor(now / oneHour) * (oneHour)) + oneHour + 12 * oneMinute;
	    let delay = next - now;
	    //delay = 3 * oneMinute;
	    console.log(`NWSscrape delay for ${Math.floor(delay/oneMinute)} minutes`);
	    state.timeout = setTimeout(() => { hourly(state) }, delay);
	}

	hourly(this);
	
    }
}
