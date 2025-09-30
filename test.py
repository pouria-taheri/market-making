class Sahra:
    def __init__(self):
        self.sahra_endpoint_url = sahra_config.endpoint_url
        self.mazdax_endpoint_url = mazdax_config.endpoint_url

    def send_request_with_retry(
        self,
        url,
        method,
        expected_status,
        try_number=sahra_config.request_tryNumber_default,
        try_time=sahra_config.request_tryTime_default,
    ):
        status = False
        for _ in range(try_number):
            response = requests.get(url)
            if response.status_code == expected_status:
                    status = True
                    message = "succeed"
                    return status, message, response
            else:
                message = "Sahra access failed"
                time.sleep(try_time)

        return status, message, response

    def get_price_series(self, candle,symbol,symbol_name, resolution=None):
        if candle == "sahra":
            now = int(time.time())
            before = now - (4 * 24 * 60 * 60)
            url = f"{self.sahra_endpoint_url}/api/v1/TradingView/History?Symbol={symbol}"
            if resolution:
                url += f"&Resolution={resolution}"
            url += "&from={}".format(before)
            url += "&to={}".format(now)
            status, message, response = self.send_request_with_retry(
                url,
                "GET",
                200,
                try_number=sahra_config.getPriceSeries_tryNumber,
                try_time=sahra_config.getPriceSeries_tryTime,
            )
            print(url)
            if status:
                price_series = list(response.json()["c"])
                if price_series and len(price_series) > 1:
                    print(
                        "function: {} url: {} ,message: {},status: {},response: {}".format(
                            "send_request_with_retry",
                            url,
                            message,
                            status,
                            price_series[-1],
                        )
                    )
                    return status, message, price_series[-1]
                else:
                    status = False
                    message = "Resolution {} Price list is empty".format(resolution)
                    return status, message, price_series
        elif candle == "sahra_commodity":
            now = int(time.time())
            before = now - (4 * 24 * 60 * 60)
            url = f"{self.sahra_endpoint_url}/api/v1/FutureTradingView/History?Symbol={symbol}"
            if resolution:
                url += f"&Resolution={resolution}"
            url += "&from={}".format(before)
            url += "&to={}".format(now)
            status, message, response = self.send_request_with_retry(
                url,
                "GET",
                200,
                try_number=sahra_config.getPriceSeries_tryNumber,
                try_time=sahra_config.getPriceSeries_tryTime,
            )
            if status:
                price_series = list(response.json()["c"])
                if price_series and len(price_series) > 1:
                    print(
                        "function: {} url: {} ,message: {},status: {},response: {}".format(
                            "send_request_with_retry",
                            url,
                            message,
                            status,
                            price_series[-1],
                        )
                    )
                    return status, message, price_series[-1]
                else:
                    status = False
                    message = "Resolution {} Price list is empty".format(resolution)
                    return status, message, price_series
        elif candle == "mazdax":
            url = f"{self.mazdax_endpoint_url}/market/rollingprice?from=mazdax&symbol={symbol_name}"
            status, message, response = self.send_request_with_retry(
                url,
                "GET",
                200,
                try_number=sahra_config.getPriceSeries_tryNumber,
                try_time=sahra_config.getPriceSeries_tryTime,
            )
            if status:
                price_series = response.json()[symbol_name]["lastPrice"]
                if price_series and len(price_series) > 1:
                    print(
                        "function: {} url: {} ,message: {},status: {},response: {}".format(
                            "send_request_with_retry",
                            url,
                            message,
                            status,
                            price_series,
                        )
                    )
                    return status, message, price_series
            else:
                status = False
                message = "Mazdax last_price list is empty"
                return status, message, price_series
        else:
            return status, message, []