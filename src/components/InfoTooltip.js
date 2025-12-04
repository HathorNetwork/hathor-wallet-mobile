/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { Image, TouchableOpacity, View } from 'react-native';
import infoCircle from '../assets/icons/info-circle.png';

function InfoTooltip({ children }) {
  const [isTooltipShown, setIsTooltipShown] = useState(false);
  const [pressLocation, setPressLocation] = useState({ x: 0, y: 0 });

  const handlePressIn = (event) => {
    setPressLocation({ x: event.pageX, y: event.pageY });
    setIsTooltipShown(!isTooltipShown);
  };

  return (
    <TouchableOpacity
      // onPressIn={handlePressIn}
      style={{ position: 'relative', display: 'block', overflow: 'visible' }}
    >
      <Image source={infoCircle} width={24} height={24} />
      {isTooltipShown && (
        <View
          style={{
            position: 'relative',
            top: pressLocation.y + 20,
            left: pressLocation.x + 20,
            backgroundColor: 'gray',
            color: 'white',
            padding: '5px 10px',
            borderRadius: '4px',
            zIndex: 1000,
            width: 'auto',
          }}
        >
          {children}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default InfoTooltip;
