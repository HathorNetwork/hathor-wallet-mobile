import * as React from 'react'
import Svg, { G, Path, Defs, ClipPath } from 'react-native-svg'
import { BaseIcon } from './Base.icon';

/**
 * @param {SvgProps|{type: 'default'|'outline'|'fill'}} props
 *
 * @description
 * Svg converted from Figma using transaformer at https://react-svgr.com/playground/?native=true
 */
export const SentIcon = (props) => (
  <BaseIcon type={props.type || 'default'}>
    <Svg
      xmlns='http://www.w3.org/2000/svg'
      width={24}
      height={24}
      fill='none'
      {...props}
    >
      <G clipPath='url(#a)'>
        <Path
          fill={props.color || '#000'}
          fillRule='evenodd'
          d='M18.739 13.216V4.731h-8.485a.75.75 0 1 0 0 1.5h5.924L5.261 17.148a.75.75 0 1 0 1.06 1.06L17.24 7.293v5.924a.75.75 0 1 0 1.5 0Z'
          clipRule='evenodd'
        />
      </G>
      <Defs>
        <ClipPath id='a'>
          <Path
            fill={props.color || '#fff'}
            d='M0 0h24v24H0z'
          />
        </ClipPath>
      </Defs>
    </Svg>
  </BaseIcon>
);
